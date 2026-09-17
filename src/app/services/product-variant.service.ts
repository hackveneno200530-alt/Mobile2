import { Injectable } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, ProductVariant, ProductVariantInput } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class ProductVariantService {
  private readonly endpoint = '/catalog/variants.php';

  async list(productId?: number): Promise<ProductVariant[]> {
    const params = productId ? { product_id: productId } : {};
    const { data } = await apiClient.get<ApiResponse<ProductVariant[]>>(this.endpoint, { params });
    return data.data ?? [];
  }

  async get(id: number): Promise<ProductVariant | null> {
    const { data } = await apiClient.get<ApiResponse<ProductVariant>>(this.endpoint, { params: { id } });
    return data.data;
  }

  /** Crea la variante y, en el mismo request del backend, su fila de inventario en 0. */
  async create(input: ProductVariantInput): Promise<ProductVariant> {
    const { data } = await apiClient.post<ApiResponse<ProductVariant>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  async update(id: number, input: Partial<ProductVariantInput>): Promise<ProductVariant> {
    const { data } = await apiClient.put<ApiResponse<ProductVariant>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  /** Elimina la variante; su fila de inventario se elimina en cascada (FK ON DELETE CASCADE). */
  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
