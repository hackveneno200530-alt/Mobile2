---
name: delrio-caps-architecture
description: Enforces Del Rio Caps e-commerce architecture rules for Angular 22, Ionic 9, Capacitor 8, and PHP/MySQL. Use when creating or modifying UI tabs, product catalog views, variant selectors, cart logic, API services, or checkout transactions.
---

# Del Río Caps Architecture Guide

This skill governs all development within the Del Río Caps e-commerce repository (`c:/agente/9b`). Any code generated or modified by other skills (such as `angular-developer`, `angular-ionic-capacitor`, or `typescript-pro`) must strictly adhere to the project foundations and patterns documented below.

---

## 1. API Client & Networking Rules

### 🚫 Strictly Forbidden:
- Do **NOT** use Angular's `HttpClient` or `provideHttpClient()`.
- Do **NOT** instantiate isolated `axios.create()`, global `axios`, or raw `fetch()`.

### ✅ Required Pattern:
All HTTP communication must import and use the centralized Axios client from `src/app/services/api-client.ts`:

```typescript
import { apiClient } from './api-client';
import { ApiResponse } from '../models/catalog.models';

const { data } = await apiClient.get<ApiResponse<T>>('/catalog/products.php');
```

**Why:**
- `apiClient` integrates with `ApiConfigService` (`src/app/services/api-config.service.ts`) to dynamically switch between `localhost`, Android emulator alias `10.0.2.2`, and LAN IPs without rebuilding.
- Responses and failures automatically update `lastApiCall` diagnostics for `api-error-modal.component.ts`.
- Sensitive fields like passwords are automatically masked in telemetry.

---

## 2. Offline-First & Resilient Caching

Every catalog-reading service (`ProductService`, `CategoryService`, `ProductVariantService`) must implement the offline-first pattern using `CacheService` and `NetworkStatusService`.

### Required Cache Pattern (`listWithCache`):
```typescript
import { inject } from '@angular/core';
import { apiClient } from './api-client';
import { CacheService } from './cache.service';
import { ApiResponse, Product } from '../models/catalog.models';

const CACHE_KEY = 'products';

export class ProductService {
  private cache = inject(CacheService);

  async list(): Promise<Product[]> {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/catalog/products.php');
    return data.data ?? [];
  }

  async listWithCache(): Promise<{ data: Product[]; fromCache: boolean; cachedAt: string | null }> {
    try {
      const data = await this.list();
      await this.cache.set(CACHE_KEY, data);
      return { data, fromCache: false, cachedAt: null };
    } catch (err) {
      const cached = await this.cache.get<Product[]>(CACHE_KEY);
      if (cached) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
      throw err;
    }
  }
}
```

- Always inspect `NetworkStatusService.online()` (`src/app/services/network-status.service.ts`) or display fallback indicators when serving stale cached content.

---

## 3. UI Components & Reactive State

### Modern Angular 22 & Ionic 9 Principles:
1. **Standalone Components:** Every component must specify `standalone: true`.
2. **Ionic Standalone Imports:** Import UI components exclusively from `@ionic/angular/standalone` (e.g., `IonHeader`, `IonContent`, `IonList`, `IonButton`), never from legacy `@ionic/angular` modules.
3. **Modern Control Flow:** Use `@if`, `@else`, and `@for (item of items; track item.id)` syntax instead of legacy `*ngIf` and `*ngFor`.
4. **Signals for State:** Use `signal()`, `computed()`, and `effect()`.
5. **Local Cart Integration:** Cart state is centralized in `src/app/services/local-cart.service.ts` via `@capacitor/preferences` (`delrio_cart`). Components read `cart.items()` reactively and dispatch:
   - `cart.addItem({ productId, name, price })`
   - `cart.updateQuantity(productId, quantity)`
   - `cart.removeItem(productId)`
   - `cart.clearCart()`

### Example Component Pattern:
```typescript
import { Component, inject, signal, computed } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonButton } from '@ionic/angular/standalone';
import { LocalCartService } from '../services/local-cart.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonButton]
})
export class Tab1Page {
  public cart = inject(LocalCartService);
  private productService = inject(ProductService);
  public products = signal<Product[]>([]);

  public totalCartCount = computed(() =>
    this.cart.items().reduce((sum, item) => sum + item.quantity, 0)
  );
}
```

---

## 4. Backend Architecture & ACID Checkout (`api/`)

All PHP endpoints in `api/` must follow the standards established in `api/config.php`:

1. **Authentication Verification:**
   Protected routes must verify the active user session token or validate user permissions against `users` (`role IN ('customer', 'admin')`).
2. **Strict Prepared Statements:**
   All SQL queries must use PDO prepared statements with parameter binding to prevent SQL injection.
3. **ACID Transaction Protocol for Orders & Checkout:**
   Checkout logic must execute inside an InnoDB atomic transaction:
   ```php
   $pdo = getConnection();
   $pdo->beginTransaction();
   try {
       // 1. Lock inventory rows to prevent race conditions & overselling
       $stmt = $pdo->prepare('SELECT quantity, reserved FROM inventory WHERE variant_id = :id FOR UPDATE');
       $stmt->execute(['id' => $variantId]);
       $stock = $stmt->fetch();
       
       if (!$stock || ($stock['quantity'] - $stock['reserved']) < $requestedQty) {
           throw new Exception('Stock insuficiente para la variante seleccionada.');
       }

       // 2. Reserve / deduct stock
       $updateInv = $pdo->prepare('UPDATE inventory SET quantity = quantity - :qty WHERE variant_id = :id');
       $updateInv->execute(['qty' => $requestedQty, 'id' => $variantId]);

       // 3. Create order and order items
       $createOrder = $pdo->prepare('INSERT INTO orders (user_id, shipping_address_id, billing_address_id, subtotal, total, status) VALUES (...)');
       $createOrder->execute([...]);
       $orderId = $pdo->lastInsertId();

       $pdo->commit();
       respondData(true, 'Orden creada exitosamente.', ['order_id' => $orderId]);
   } catch (Exception $e) {
       $pdo->rollBack();
       respondData(false, $e->getMessage(), null, 400);
   }
   ```
4. **Uniform JSON Responses:**
   Return responses using `respondData(bool $success, string $message, $data, int $code)` or `respond(bool $success, string $message, ?array $user, int $code)`.
