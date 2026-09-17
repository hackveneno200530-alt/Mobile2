import { Injectable } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Category, CategoryInput } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly endpoint = '/catalog/categories.php';

  async list(): Promise<Category[]> {
    const { data } = await apiClient.get<ApiResponse<Category[]>>(this.endpoint);
    return data.data ?? [];
  }

  async get(id: number): Promise<Category | null> {
    const { data } = await apiClient.get<ApiResponse<Category>>(this.endpoint, { params: { id } });
    return data.data;
  }

  async create(input: CategoryInput): Promise<Category> {
    const { data } = await apiClient.post<ApiResponse<Category>>(this.endpoint, input);
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  async update(id: number, input: Partial<CategoryInput>): Promise<Category> {
    const { data } = await apiClient.put<ApiResponse<Category>>(this.endpoint, input, { params: { id } });
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }

  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiResponse<null>>(this.endpoint, { params: { id } });
    if (!data.success) throw new Error(data.message);
  }
}
