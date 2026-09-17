import { Injectable } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Product, ProductInput } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly endpoint = '/catalog/products.php';

  async list(categoryId?: number): Promise<Product[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const { data } = await apiClient.get<ApiResponse<Product[]>>(this.endpoint, { params });
    return data.data ?? [];
  }

  async get(id: number): Promise<Product | null> {
    const { data } = await apiClient.get<ApiResponse<Product>>(this.endpoint, { params: { id } });
    return data.data;
  }

  async create(input: ProductInput): Promise<Product> {
    const { data } = await apiClient.post<ApiResponse<Product>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  async update(id: number, input: Partial<ProductInput>): Promise<Product> {
    const { data } = await apiClient.put<ApiResponse<Product>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
