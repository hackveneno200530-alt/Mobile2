import { Injectable, inject } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Product, ProductInput, ProductsResult } from '../models/catalog.models';
import { CacheService } from './cache.service';

const CACHE_KEY_PREFIX = 'products_v2_cat_';

import { FALLBACK_PRODUCTS } from './fallback-catalog';
export { FALLBACK_PRODUCTS };

@Injectable({ providedIn: 'root' })
export class ProductService {
  private cache = inject(CacheService);
  private readonly endpoint = '/catalog/products.php';

  /** Consulta: lista productos directamente de la API. */
  async list(categoryId?: number): Promise<Product[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const { data } = await apiClient.get<ApiResponse<Product[]>>(this.endpoint, { params });
    return data.data ?? [];
  }

  /**
   * Consulta con caché Offline-First:
   * Retorna los datos cacheados inmediatamente o llama a la API. Si la red
   * no responde, muestra el caché previo o el catálogo de respaldo de Del Río.
   */
  async listWithCache(categoryId?: number, forceRefresh = false): Promise<ProductsResult> {
    const cacheKey = CACHE_KEY_PREFIX + (categoryId ? String(categoryId) : 'all');

    if (!forceRefresh) {
      const cached = await this.cache.get<Product[]>(cacheKey);
      if (cached && cached.data.length > 0) {
        void this.refreshCacheInBackground(categoryId, cacheKey);
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
    }

    try {
      const data = await this.list(categoryId);
      if (data && data.length > 0) {
        await this.cache.set(cacheKey, data);
        return { data, fromCache: false, cachedAt: null };
      }
      throw new Error('Sin productos en la base de datos');
    } catch (err) {
      const cached = await this.cache.get<Product[]>(cacheKey);
      if (cached && cached.data.length > 0) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }

      // Si no hay red ni caché previo, responde con el dataset local de fallback
      const filteredFallback = categoryId
        ? FALLBACK_PRODUCTS.filter((p) => p.category_id === categoryId)
        : FALLBACK_PRODUCTS;

      await this.cache.set(cacheKey, filteredFallback);
      return { data: filteredFallback, fromCache: true, cachedAt: new Date().toISOString() };
    }
  }

  private async refreshCacheInBackground(categoryId: number | undefined, cacheKey: string): Promise<void> {
    try {
      const data = await this.list(categoryId);
      if (data && data.length > 0) {
        await this.cache.set(cacheKey, data);
      }
    } catch {
      // Background silencioso
    }
  }

  /** Consulta: un solo producto por id. */
  async get(id: number): Promise<Product | null> {
    const { data } = await apiClient.get<ApiResponse<Product>>(this.endpoint, { params: { id } });
    return data.data;
  }

  /** Consulta de producto individual con soporte de caché. */
  async getWithCache(id: number): Promise<Product | null> {
    try {
      const live = await this.get(id);
      if (live) return live;
    } catch {
      // Ignorar para caer en caché
    }
    const all = await this.listWithCache();
    return all.data.find((p) => p.id === id) ?? null;
  }

  /** Alta: crea un producto nuevo. */
  async create(input: ProductInput): Promise<Product> {
    const { data } = await apiClient.post<ApiResponse<Product>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Modificación: actualiza campos del producto. */
  async update(id: number, input: Partial<ProductInput>): Promise<Product> {
    const { data } = await apiClient.put<ApiResponse<Product>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Eliminación: borra el producto. */
  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
