import { Injectable, inject } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Inventory } from '../models/catalog.models';
import { CacheService } from './cache.service';

const CACHE_KEY_PREFIX = 'inventory_variant_';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private cache = inject(CacheService);
  private readonly endpoint = '/catalog/inventory.php';

  /** Consulta: cuanto stock tiene una variante especifica. */
  async get(variantId: number): Promise<Inventory | null> {
    const { data } = await apiClient.get<ApiResponse<Inventory>>(this.endpoint, {
      params: { variant_id: variantId },
    });
    return data.data;
  }

  /** Consulta de inventario con respaldo en caché. */
  async getWithCache(variantId: number, forceRefresh = false): Promise<Inventory | null> {
    const cacheKey = CACHE_KEY_PREFIX + variantId;
    if (!forceRefresh) {
      const cached = await this.cache.get<Inventory>(cacheKey);
      if (cached) return cached.data;
    }
    try {
      const live = await this.get(variantId);
      if (live) {
        await this.cache.set(cacheKey, live);
        return live;
      }
    } catch {
      const cached = await this.cache.get<Inventory>(cacheKey);
      if (cached) return cached.data;
    }
    return null;
  }

  /** Modificacion: fija la cantidad de stock de una variante. */
  async setQuantity(variantId: number, quantity: number): Promise<Inventory> {
    const { data } = await apiClient.put<ApiResponse<Inventory>>(
      this.endpoint,
      { quantity },
      { params: { variant_id: variantId } },
    );
    if (!data.success || !data.data) throw new Error(data.message);
    await this.cache.set(CACHE_KEY_PREFIX + variantId, data.data);
    return data.data;
  }
}
