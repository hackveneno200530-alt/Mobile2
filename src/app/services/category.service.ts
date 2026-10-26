import { Injectable, inject } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Category, CategoryInput, CategoriesResult } from '../models/catalog.models';
import { CacheService } from './cache.service';

const CACHE_KEY = 'categories_v2';

const FALLBACK_CATEGORIES: Category[] = [
  { id: 2, parent_id: null, name: 'Gorras', slug: 'gorras' },
  { id: 3, parent_id: null, name: 'Ropa', slug: 'ropa' },
  { id: 4, parent_id: null, name: 'Calzado', slug: 'calzado' },
  { id: 5, parent_id: null, name: 'Perfumes', slug: 'perfumes' },
];

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private cache = inject(CacheService);
  private readonly endpoint = '/catalog/categories.php';

  /** Consulta: trae todas las categorias desde la API. */
  async list(): Promise<Category[]> {
    const { data } = await apiClient.get<ApiResponse<Category[]>>(this.endpoint);
    return data.data ?? [];
  }

  /**
   * Estrategia de cache Offline-First:
   * 1. Si no es forceRefresh, intenta responder desde cache.
   * 2. Si falla la red, recurre a cache o al fallback seguro sin romper la app.
   */
  async listWithCache(forceRefresh = false): Promise<CategoriesResult> {
    if (!forceRefresh) {
      const cached = await this.cache.get<Category[]>(CACHE_KEY);
      if (cached && cached.data.length > 0) {
        // En background actualizamos cache si hay red
        void this.refreshCacheInBackground();
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
    }

    try {
      const data = await this.list();
      if (data && data.length > 0) {
        await this.cache.set(CACHE_KEY, data);
        return { data, fromCache: false, cachedAt: null };
      }
      throw new Error('Sin categorías en la base de datos');
    } catch (err) {
      const cached = await this.cache.get<Category[]>(CACHE_KEY);
      if (cached && cached.data.length > 0) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
      }
      // Fallback offline predeterminado si es la primera vez y no hay red
      await this.cache.set(CACHE_KEY, FALLBACK_CATEGORIES);
      return { data: FALLBACK_CATEGORIES, fromCache: true, cachedAt: new Date().toISOString() };
    }
  }

  private async refreshCacheInBackground(): Promise<void> {
    try {
      const data = await this.list();
      if (data && data.length > 0) {
        await this.cache.set(CACHE_KEY, data);
      }
    } catch {
      // Silencioso en background
    }
  }

  /** Consulta: trae una sola categoria por id. */
  async get(id: number): Promise<Category | null> {
    const { data } = await apiClient.get<ApiResponse<Category>>(this.endpoint, { params: { id } });
    return data.data;
  }

  /** Alta: crea una categoria nueva. */
  async create(input: CategoryInput): Promise<Category> {
    const { data } = await apiClient.post<ApiResponse<Category>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Modificacion: actualiza una categoria existente. */
  async update(id: number, input: Partial<CategoryInput>): Promise<Category> {
    const { data } = await apiClient.put<ApiResponse<Category>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Eliminacion: borra una categoria por id. */
  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
