import { Injectable, inject } from '@angular/core';
import { apiClient } from './api-client';
import {
  ApiResponse,
  CheckoutInput,
  CheckoutResult,
  Order,
  CacheResult,
} from '../models/catalog.models';
import { CacheService } from './cache.service';

const ORDERS_CACHE_PREFIX = 'user_orders_';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private cache = inject(CacheService);

  /**
   * Ejecuta el checkout transaccional contra el endpoint PHP con row-locking.
   */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const { data } = await apiClient.post<ApiResponse<CheckoutResult>>(
      '/orders/checkout.php',
      input
    );
    if (!data.success || !data.data) {
      throw new Error(data.message || 'Error al procesar el pedido.');
    }

    // Invalidar caché de órdenes para que se recargue actualizada
    await this.cache.set(ORDERS_CACHE_PREFIX + input.user_id, null);

    return data.data;
  }

  /**
   * Consulta las órdenes activas del usuario desde el servidor.
   */
  async list(userId: number): Promise<Order[]> {
    const { data } = await apiClient.get<ApiResponse<Order[]>>('/orders/list.php', {
      params: { user_id: userId },
    });
    return data.data ?? [];
  }

  /**
   * Historial de órdenes con soporte de caché Offline-First:
   */
  async listWithCache(userId: number, forceRefresh = false): Promise<CacheResult<Order[]>> {
    const cacheKey = ORDERS_CACHE_PREFIX + userId;

    if (!forceRefresh) {
      const cached = await this.cache.get<Order[]>(cacheKey);
      if (cached && cached.data.length > 0) {
        void this.refreshCacheInBackground(userId, cacheKey);
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
    }

    try {
      const data = await this.list(userId);
      await this.cache.set(cacheKey, data);
      return { data, fromCache: false, cachedAt: null };
    } catch (err) {
      const cached = await this.cache.get<Order[]>(cacheKey);
      if (cached && cached.data) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
      return { data: [], fromCache: true, cachedAt: new Date().toISOString() };
    }
  }

  private async refreshCacheInBackground(userId: number, cacheKey: string): Promise<void> {
    try {
      const data = await this.list(userId);
      await this.cache.set(cacheKey, data);
    } catch {
      // Silencioso
    }
  }
}
