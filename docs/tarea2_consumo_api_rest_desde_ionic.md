# UNIVERSIDAD POLITÉCNICA DE DURANGO
**Ingeniería en Software — 9° Cuatrimestre**  
**Materia:** Programación Móvil II (9B)  
**Unidad II:** Arquitectura Cliente-Servidor en los móviles  
**Actividad:** Consumo de API REST desde Ionic  
**Proyecto:** E-Commerce Del Río Caps (Capacitor 8 + Ionic 9 + Angular 22 + PHP 8 + MySQL)  
**Repositorio GitHub:** [https://github.com/hackveneno200530-alt/Mobile2.git](https://github.com/hackveneno200530-alt/Mobile2.git)

---

## 1. Petición GET

La petición `GET` se utiliza para la recuperación de datos desde el backend sin alterar el estado de la base de datos (operación segura e idempotente).

### 1.1. Implementación en el Servicio Angular (`ProductService`)
```typescript
/**
 * Consulta en vivo al endpoint REST vía GET.
 * Permite filtrar de forma opcional por category_id mediante query params.
 */
async list(categoryId?: number): Promise<Product[]> {
  const params = categoryId ? { category_id: categoryId } : {};
  const { data } = await apiClient.get<ApiResponse<Product[]>>(this.endpoint, { params });
  return data.data ?? [];
}
```

### 1.2. Endpoint en PHP (`api/catalog/products.php`)
```php
if ($method === 'GET') {
    $baseSql = 'SELECT p.*, c.name AS category_name,
                       COALESCE((SELECT SUM(i.quantity) FROM product_variants pv JOIN inventory i ON pv.id = i.variant_id WHERE pv.product_id = p.id), 0) AS total_stock
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id';

    if ($categoryId !== null) {
        $stmt = $pdo->prepare($baseSql . ' WHERE p.category_id = :cat ORDER BY p.name');
        $stmt->execute(['cat' => $categoryId]);
        respondData(true, 'OK', $stmt->fetchAll());
    }

    $stmt = $pdo->query($baseSql . ' ORDER BY p.name');
    respondData(true, 'OK', $stmt->fetchAll());
}
```

### 1.3. Ejemplo de Petición y Respuesta
- **Solicitud HTTP:**
  ```http
  GET /9b-api/catalog/products.php?category_id=4 HTTP/1.1
  Host: localhost
  Accept: application/json
  X-Client-Platform: Ionic-Angular-Mobile
  ```
- **Respuesta JSON (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "OK",
    "data": [
      {
        "id": 1,
        "category_id": 4,
        "category_name": "Calzado",
        "sku_base": "NK-AF1-07",
        "name": "Nike Air Force 1 '07 Triple White",
        "description": "El ícono legendario del streetwear en piel genuina blanca.",
        "brand": "Nike",
        "base_price": "2499.00",
        "image_url": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800",
        "active": 1,
        "total_stock": 63
      }
    ]
  }
  ```

---

## 2. Petición POST

La petición `POST` se utiliza para la creación de nuevos recursos o el envío de cargas útiles estructuradas para operaciones de negocio transaccionales (ej. autenticación y compras).

### 2.1. Implementación en el Servicio Angular (`OrderService`)
```typescript
/**
 * Envía la orden de compra al servidor con validación transaccional.
 */
async checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const { data } = await apiClient.post<ApiResponse<CheckoutResult>>(
    '/orders/checkout.php',
    input
  );
  if (!data.success || !data.data) {
    throw new Error(data.message || 'Error al procesar la compra.');
  }
  return data.data;
}
```

### 2.2. Endpoint en PHP (`api/orders/checkout.php`)
```php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $userId = (int) ($body['user_id'] ?? 0);
    $items = $body['items'] ?? [];

    $pdo->beginTransaction();
    try {
        // Bloqueo pesimista para evitar sobreventa (race conditions)
        foreach ($items as $item) {
            $stmt = $pdo->prepare('SELECT quantity FROM inventory WHERE variant_id = :id FOR UPDATE');
            $stmt->execute(['id' => $item['variant_id']]);
            $inv = $stmt->fetch();
            if (!$inv || $inv['quantity'] < $item['quantity']) {
                $pdo->rollBack();
                respondData(false, 'Stock insuficiente para el producto.', null, 409);
            }
        }
        // Inserción del pedido y descuento atómico de existencias...
        $pdo->commit();
        respondData(true, 'Pedido confirmado exitosamente.', $orderData, 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        respondData(false, 'Error transaccional: ' . $e->getMessage(), null, 500);
    }
}
```

### 2.3. Ejemplo de Petición y Respuesta
- **Solicitud HTTP:**
  ```http
  POST /9b-api/orders/checkout.php HTTP/1.1
  Host: localhost
  Content-Type: application/json
  
  {
    "user_id": 4,
    "delivery_type": "store_pickup",
    "payment_method": "cash",
    "items": [{ "variant_id": 9, "quantity": 1, "unit_price": 2199.00 }]
  }
  ```
- **Respuesta JSON (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Pedido confirmado exitosamente.",
    "data": {
      "order_id": 2,
      "folio": "DRC-000002",
      "total": 2199.00,
      "status": "pending"
    }
  }
  ```

---

## 3. Petición PUT / PATCH

La petición `PUT` actualiza entidades existentes en la base de datos de manera idempotente pasando el identificador en la query string (`?id=X`) y los campos modificados en el cuerpo JSON.

### 3.1. Implementación en el Servicio Angular (`ProductService`)
```typescript
/**
 * Modificación: actualiza campos del producto de forma parcial o total.
 */
async update(id: number, input: Partial<ProductInput>): Promise<Product> {
  const { data } = await apiClient.put<ApiResponse<Product>>(this.endpoint, input, {
    params: { id },
  });
  if (!data.success || !data.data) {
    throw new Error(data.message);
  }
  return data.data;
}
```

### 3.2. Endpoint en PHP (`api/catalog/products.php`)
```php
if ($method === 'PUT') {
    if ($id === null) {
        respondData(false, 'Falta el parámetro id.', null, 422);
    }

    $body = readJsonBody();
    $fields = [];
    $params = ['id' => $id];

    // Construcción dinámica de la sentencia UPDATE según los campos recibidos
    foreach (['category_id', 'sku_base', 'name', 'description', 'brand', 'base_price', 'image_url', 'active'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = :$col";
            $params[$col] = $col === 'active' ? ((bool) $body[$col] ? 1 : 0) : $body[$col];
        }
    }

    if (empty($fields)) {
        respondData(false, 'No se enviaron campos para actualizar.', null, 422);
    }

    $sql = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = :id';
    $pdo->prepare($sql)->execute($params);

    $updated = $pdo->prepare('SELECT * FROM products WHERE id = :id');
    $updated->execute(['id' => $id]);
    respondData(true, 'Producto actualizado.', $updated->fetch(), 200);
}
```

### 3.3. Ejemplo de Petición y Respuesta
- **Solicitud HTTP:**
  ```http
  PUT /9b-api/catalog/products.php?id=1 HTTP/1.1
  Host: localhost
  Content-Type: application/json
  
  {
    "base_price": 2399.00,
    "description": "Edición especial con descuento de temporada."
  }
  ```
- **Respuesta JSON (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Producto actualizado.",
    "data": {
      "id": 1,
      "name": "Nike Air Force 1 '07 Triple White",
      "base_price": "2399.00",
      "active": 1
    }
  }
  ```

---

## 4. Petición DELETE

La petición `DELETE` remueve un registro existente. En nuestra arquitectura, las variantes e inventarios asociados se eliminan en cascada (`ON DELETE CASCADE`) para mantener la integridad referencial.

### 4.1. Implementación en el Servicio Angular (`ProductService`)
```typescript
/**
 * Eliminación física del producto.
 */
async remove(id: number): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, {
    params: { id },
  });
  if (!data.success) {
    throw new Error(data.message);
  }
}
```

### 4.2. Endpoint en PHP (`api/catalog/products.php`)
```php
if ($method === 'DELETE') {
    if ($id === null) {
        respondData(false, 'Falta el parámetro id.', null, 422);
    }

    $stmt = $pdo->prepare('DELETE FROM products WHERE id = :id');
    $stmt->execute(['id' => $id]);

    if ($stmt->rowCount() === 0) {
        respondData(false, 'Producto no encontrado.', null, 404);
    }

    respondData(true, 'Producto eliminado exitosamente.', null, 200);
}
```

### 4.3. Ejemplo de Petición y Respuesta
- **Solicitud HTTP:**
  ```http
  DELETE /9b-api/catalog/products.php?id=99 HTTP/1.1
  Host: localhost
  Accept: application/json
  ```
- **Respuesta JSON (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Producto eliminado exitosamente.",
    "data": null
  }
  ```

---

## 5. Servicios Angular Implementados

Todos los servicios residen en `src/app/services/`, desacoplados de la UI y gestionados como singletons (`providedIn: 'root'`):

| Servicio | Archivo | Responsabilidad |
| :--- | :--- | :--- |
| **ApiClient** | `api-client.ts` | Instancia global de Axios con interceptores de headers (`X-Client-Platform`), timestamp y manejo de errores. |
| **ApiConfigService** | `api-config.service.ts` | Resolución inteligente de IP (`10.0.2.2` en Android Emulator, IP LAN en físico y `localhost` en web) con selector en caliente persistido en Preferences. |
| **ProductService** | `product.service.ts` | Operaciones CRUD completas de productos y soporte Offline-First con caché local. |
| **CategoryService** | `category.service.ts` | CRUD de categorías con caché y fallback sincronizado. |
| **ProductVariantService** | `product-variant.service.ts` | Consulta y gestión de variantes (tallas, volumen ml, precio y stock de inventario). |
| **OrderService** | `order.service.ts` | Envío de checkout con ACID backend e historial de pedidos del cliente. |
| **AuthService** | `auth.service.ts` | Login, registro y persistencia de sesión del usuario en `@capacitor/preferences`. |
| **CacheService** | `cache.service.ts` | Almacenamiento local clave-valor con fecha de expiración y versión de caché `v2`. |

---

## 6. Manejo de Respuestas y Errores

### 6.1. Contrato de Respuesta Estandarizado (`ApiResponse<T>`)
Toda respuesta del backend está fuertemente tipada:
```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  user?: User;
}
```

### 6.2. Interceptor Global de Diagnóstico (`api-client.ts`)
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as ApiResponse<any> | undefined;

      if (status === 409) {
        console.warn('[Conflicto de Inventario / Concurrencia]:', data?.message);
      } else if (status === 422) {
        console.warn('[Error de Validación]:', data?.message);
      }
    } else if (error.request) {
      console.error('[Error de Conexión]: El servidor Apache/XAMPP no respondió.');
    }
    return Promise.reject(error);
  }
);
```

### 6.3. Modal Dinámico de Diagnóstico (`ApiErrorModalComponent`)
Si una petición crítica falla o el servidor responde con error, la aplicación despliega un modal visual de diagnóstico con:
- Código de error HTTP (`500`, `401`, `404`, `ECONNREFUSED`).
- Dirección IP y URL destino del endpoint que falló.
- Payload enviado y cabeceras de respuesta.
- Acceso directo a la configuración de servidor sin reiniciar la app.

---

## 7. Loading durante las Solicitudes

Se implementaron tres estrategias de feedback visual para evitar que el usuario perciba bloqueos o envíe peticiones duplicadas:

### 7.1. Skeletons Animados en Carga de Catálogo (`tab1.page.html`)
Mientras el signal reactivo `loading()` es `true`, se muestra la estructura vacía animada mediante `IonSkeletonText`:
```html
@if (loading()) {
  <ion-grid class="products-grid ion-padding-horizontal">
    <ion-row>
      @for (i of [1, 2, 3, 4]; track i) {
        <ion-col size="6" size-md="4" size-lg="3">
          <div class="skeleton-card">
            <ion-skeleton-text [animated]="true" class="skeleton-image"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 40%; height: 12px; margin-top: 10px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 85%; height: 16px; margin-top: 6px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 50%; height: 20px; margin-top: 8px;"></ion-skeleton-text>
          </div>
        </ion-col>
      }
    </ion-row>
  </ion-grid>
}
```

### 7.2. Pull-to-Refresh Nativo (`ion-refresher`)
Permite deslizar hacia abajo en la pantalla táctil para forzar la sincronización con la API:
```html
<ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
  <ion-refresher-content
    pullingIcon="arrow-down-outline"
    pullingText="Desliza para actualizar catálogo"
    refreshingSpinner="crescent"
    refreshingText="Sincronizando con Del Río Caps..."
  ></ion-refresher-content>
</ion-refresher>
```

### 7.3. Spinners en Botones de Envío (`login.page.html` y `checkout.page.html`)
Durante el procesamiento de formularios (`isSubmitting()` o `isProcessing()`), el botón de acción se deshabilita para evitar peticiones duplicadas y muestra un `ion-spinner`:
```html
<ion-button expand="block" type="submit" [disabled]="isSubmitting() || form.invalid">
  @if (isSubmitting()) {
    <ion-spinner name="crescent" class="btn-spinner"></ion-spinner>
    <span>Iniciando sesión...</span>
  } @else {
    <span>Ingresar a mi cuenta</span>
  }
</ion-button>
```

---

## 8. Evidencia del Funcionamiento en Emulador Google Pixel

A continuación se presenta la secuencia visual de ejecución sobre el emulador Android de Google Pixel con la ubicación de las capturas almacenadas en `C:\Users\hackv\Pictures\android\`:

### 8.1. Autenticación y Selector de IP de Servidor
Muestra la pantalla de inicio de sesión con el selector dinámico del servidor (`10.0.2.2` para el entorno emulado de Android hacia el localhost del host).

Insertar cap 1 aquí

---

### 8.2. Interceptor de Diagnóstico y Modal de Error HTTP
Muestra la intercepción de códigos HTTP por parte del cliente Axios y la presentación amigable de errores técnicos en pantalla.

Insertar cap 2 aquí

---

### 8.3. Catálogo Principal con Carga de Productos vía GET
Renderizado de la cuadrícula de artículos recuperados desde la base de datos MySQL mediante la petición `GET /catalog/products.php`.

Insertar cap 3 aquí

---

### 8.4. Filtrado de Artículos por Categoría
Muestra el consumo de la API mediante parámetros de consulta (`?category_id=4`) al seleccionar el chip "Calzado".

Insertar cap 4 aquí

---

### 8.5. Modal Bottom Sheet de Variantes con Stock en Vivo
Consulta y renderizado de tallas, colores y existencias disponibles en almacén vía `GET /catalog/variants.php`.

Insertar cap 5 aquí

---

### 8.6. Carrito de Compras Local Reactivo
Gestión del estado de compras local con cálculo automático de subtotales, regla de envío gratis y persistencia en memoria y Preferences.

Insertar cap 6 aquí

---

### 8.7. Formulario Transaccional de Checkout
Pantalla de confirmación de pedido con selección de método de entrega (Recolección en Tienda / Envío) y método de pago (Efectivo / SPEI).

Insertar cap 7 aquí

---

### 8.8. Confirmación de Compra Transaccional (POST) y Ticket
Resultado exitoso de la petición `POST /orders/checkout.php` con código HTTP 201 Created y generación del folio único de compra (`DRC-000002`).

Insertar cap 8 aquí

---

### 8.9. Historial de Pedidos del Cliente vía REST
Listado de compras históricas del usuario autenticado consultadas al endpoint `GET /orders/list.php?user_id=X`.

Insertar cap 9 aquí

---

### 8.10. Diagnóstico de Orígenes de Datos y Caché Local
Panel de control de red con verificación de protocolo HTTP, dirección IP activa, puerto y estado del almacenamiento en caché sin conexión.

Insertar cap 10 aquí

---

## 9. Código Subido a Git

El código del proyecto se encuentra versionado y publicado en GitHub bajo la rama principal:

- **URL del Repositorio:** `https://github.com/hackveneno200530-alt/Mobile2.git`
- **Rama:** `main`
- **Mensaje de Confirmación:**
  ```text
  feat(api-rest): implementacion completa de consumo RESTful (GET, POST, PUT, DELETE) con servicios Angular, manejo de errores y loading
  ```

---

## 10. Prompts Utilizados en el Desarrollo

Conforme a las indicaciones del docente, se presentan los tres prompts clave utilizados con el asistente de Inteligencia Artificial para llevar a cabo esta práctica:

### Prompt 1: Creación de Servicios y Consumo de los Verbos HTTP (GET, POST, PUT, DELETE)
> *"Actúa como Desarrollador Senior en Ionic 9 y Angular 22 Standalone. Necesito conectar nuestra aplicación móvil con la API REST en PHP y MySQL. Implementa los servicios Angular para el catálogo de productos (ProductService) y variantes (ProductVariantService) con soporte para los cuatro métodos HTTP fundamentales: GET para listar y consultar por categoría, POST para crear nuevos artículos, PUT para actualización parcial/total de campos, y DELETE para eliminación con borrado en cascada. Centraliza todas las peticiones a través de nuestro cliente compartido Axios respetando el tipado genérico ApiResponse<T>."*

### Prompt 2: Manejo de Estados de Carga (Loading, Skeletons y Pull to Refresh)
> *"Optimiza la experiencia de usuario (UX) en Tab 1 durante la comunicación asíncrona con el backend. Implementa un estado reactivo con Signals (loading e isRefreshing). Mientras los productos se descargan de la API, renderiza una grilla de IonSkeletonText animados que simulen las tarjetas de producto reales. Agrega además un IonRefresher nativo con spinner crescent para recargar el catálogo con un gesto táctil deslizable, y asegúrate de que los botones de Login y Checkout muestren un spinner y se deshabiliten mientras se procesa la solicitud para evitar peticiones duplicadas."*

### Prompt 3: Interceptor de Errores, Diagnóstico en Pantalla y Commit a Git
> *"Diseña la gestión de excepciones de red y control de errores en la aplicación móvil. En el cliente HTTP, agrega un interceptor de respuesta que capture errores 404, 409 (conflicto de stock) y 500, enlazándolo con un modal visual de diagnóstico (ApiErrorModalComponent) que permita al usuario reintentar la conexión o cambiar la IP del servidor en caliente. Al finalizar, limpia el archivo .gitignore para omitir archivos temporales y realiza el commit y push a la rama main de nuestro repositorio de GitHub con un mensaje estructurado bajo la convención Conventional Commits."*
