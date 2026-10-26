import { Injectable, inject } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, ProductVariant, ProductVariantInput, ProductVariantsResult } from '../models/catalog.models';
import { CacheService } from './cache.service';

const CACHE_KEY_PREFIX = 'variants_v2_product_';

import { FALLBACK_VARIANTS } from './fallback-catalog';
export { FALLBACK_VARIANTS };

@Injectable({ providedIn: 'root' })
export class ProductVariantService {
  private cache = inject(CacheService);
  private readonly endpoint = '/catalog/variants.php';

  /** Consulta: lista variantes desde la API. */
  async list(productId?: number): Promise<ProductVariant[]> {
    const params = productId ? { product_id: productId } : {};
    const { data } = await apiClient.get<ApiResponse<ProductVariant[]>>(this.endpoint, { params });
    return data.data ?? [];
  }

  /**
   * Consulta variantes con soporte de caché Offline-First:
   */
  async listWithCache(productId: number, forceRefresh = false): Promise<ProductVariantsResult> {
    const cacheKey = CACHE_KEY_PREFIX + productId;

    if (!forceRefresh) {
      const cached = await this.cache.get<ProductVariant[]>(cacheKey);
      if (cached && cached.data.length > 0) {
        void this.refreshCacheInBackground(productId, cacheKey);
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
    }

    try {
      const data = await this.list(productId);
      if (data && data.length > 0) {
        await this.cache.set(cacheKey, data);
        return { data, fromCache: false, cachedAt: null };
      }
      throw new Error('Sin variantes en la base de datos');
    } catch (err) {
      const cached = await this.cache.get<ProductVariant[]>(cacheKey);
      if (cached && cached.data.length > 0) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }

      const fallback = FALLBACK_VARIANTS[productId] ?? [];
      await this.cache.set(cacheKey, fallback);
      return { data: fallback, fromCache: true, cachedAt: new Date().toISOString() };
    }
  }

  private async refreshCacheInBackground(productId: number, cacheKey: string): Promise<void> {
    try {
      const data = await this.list(productId);
      if (data && data.length > 0) {
        await this.cache.set(cacheKey, data);
      }
    } catch {
      // Silencioso en background
    }
  }

  /** Consulta: una sola variante por id. */
  async get(id: number): Promise<ProductVariant | null> {
    const { data } = await apiClient.get<ApiResponse<ProductVariant>>(this.endpoint, { params: { id } });
    return data.data;
  }

  /** Alta: crea la variante. */
  async create(input: ProductVariantInput): Promise<ProductVariant> {
    const { data } = await apiClient.post<ApiResponse<ProductVariant>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Modificación: actualiza campos de la variante. */
  async update(id: number, input: Partial<ProductVariantInput>): Promise<ProductVariant> {
    const { data } = await apiClient.put<ApiResponse<ProductVariant>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Eliminación: borra la variante. */
  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
