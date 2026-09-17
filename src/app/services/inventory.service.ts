import { Injectable } from '@angular/core';
import { apiClient } from './api-client';
import { ApiResponse, Inventory } from '../models/catalog.models';

/**
 * No expone create/delete: la fila de inventario nace junto con la
 * variante (ProductVariantService.create) y muere en cascada junto
 * con ella (ON DELETE CASCADE). Aquí solo se lee y se ajusta cantidad.
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly endpoint = '/catalog/inventory.php';

  async get(variantId: number): Promise<Inventory | null> {
    const { data } = await apiClient.get<ApiResponse<Inventory>>(this.endpoint, {
      params: { variant_id: variantId },
    });
    return data.data;
  }

  async setQuantity(variantId: number, quantity: number): Promise<Inventory> {
    const { data } = await apiClient.put<ApiResponse<Inventory>>(
      this.endpoint,
      { quantity },
      { params: { variant_id: variantId } },
    );
    if (!data.success || !data.data) throw new Error(data.message);
    return data.data;
  }
}
