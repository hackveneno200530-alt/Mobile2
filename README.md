# 9b — Ionic + Angular con Login/Registro contra API PHP

## Objetivo de la aplicación

Aplicación móvil/web construida con **Ionic + Angular (standalone components)** que agrega un
flujo de **autenticación (login y registro)** delante del tutorial oficial de galería de fotos
de Ionic. El objetivo es demostrar un flujo completo de extremo a extremo:

1. El usuario abre la app y ve una pantalla de **Login / Sign Up** con animación de flip.
2. El formulario envía las credenciales mediante **Axios** a una **API en PHP** (`api/`).
3. La API valida contra una base de datos **MySQL** (tabla `users`) usando `PDO` y hashes
   `bcrypt` (`password_hash` / `password_verify`).
4. Si el login es exitoso, el usuario entra a la sección de **tabs** (Explore, Photos, Tab3),
   donde puede tomar fotos con la cámara del dispositivo (funcionalidad original del tutorial
   de Ionic, sin modificar).

## Características

* **Login / Registro** (`src/app/login/`): formulario dual con animación neumórfica, validación
  básica y manejo de errores de red.
* **AuthService** (`src/app/services/auth.service.ts`): cliente Axios que consume la API PHP.
* **API PHP** (`api/`): endpoints `login.php` y `register.php`, con CORS habilitado y respuestas
  JSON consistentes.
* **Modelo de datos** (`api/schema.sql`): tabla `users` + registro inicial (usuario demo).
* **Tabs originales del tutorial de Ionic**: Explore (Tab1), Photos (Tab2, cámara + filesystem +
  preferences vía Capacitor) y Tab3.

## Estructura del proyecto

```
src/app/
  login/            -> Vista de login/registro (LoginPage)
  services/
    auth.service.ts -> Cliente Axios hacia la API PHP
    photo.service.ts-> Lógica de cámara/almacenamiento (tutorial original)
  tab1/             -> Vista "Explore" (placeholder original del tutorial)
  tab2/             -> Galería de fotos
  tab3/             -> Vista adicional del tutorial
  tabs/             -> Shell de navegación por tabs
api/
  config.php        -> Conexión PDO + cabeceras CORS + helpers de respuesta
  login.php         -> POST /login.php  { email, password }
  register.php      -> POST /register.php { name, email, password }
  schema.sql         -> DDL de la tabla `users` + carga inicial (usuario demo)
```

## Cómo correrlo

### 1. Frontend (Ionic/Angular)

```bash
npm install
ionic serve
```

La app queda disponible en `http://localhost:8100` y arranca directo en `/login`.

### 2. API (PHP + MySQL)

Requiere un servidor con PHP y MySQL (por ejemplo XAMPP):

1. Copia la carpeta `api/` dentro del `htdocs` de tu servidor, por ejemplo:
   `C:\xampp\htdocs\9b-api\`.
2. Importa `api/schema.sql` en tu MySQL (crea la base `ionic_login`, la tabla `users` y siembra
   un usuario demo).
3. Ajusta `src/environments/environment.ts` (`apiUrl`) si tu servidor no corre en
   `http://localhost/9b-api`.

**Usuario de prueba** (creado por `schema.sql`):

| Email | Password |
|---|---|
| `demo@example.com` | `Demo1234!` |

### 3. Probar la API directamente (sin la app)

```bash
curl -X POST http://localhost/9b-api/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo1234!"}'
```

Respuesta esperada:

```json
{
  "success": true,
  "message": "Login exitoso.",
  "user": { "id": 1, "name": "Usuario Demo", "email": "demo@example.com", "created_at": "..." }
}
```

## Créditos

Basado en el tutorial oficial ["Your First App: Angular"](https://ionicframework.com/docs/angular/your-first-app)
de Ionic (galería de fotos con Capacitor), extendido con autenticación propia.
