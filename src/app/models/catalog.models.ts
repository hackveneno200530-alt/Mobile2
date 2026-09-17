// Interfaces alineadas 1:1 con el esquema SQL (database/database.sql)

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
}

export type CategoryInput = Omit<Category, 'id'>;

export interface Product {
  id: number;
  category_id: number;
  sku_base: string;
  name: string;
  description: string | null;
  brand: string | null;
  base_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>;

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  size: string | null;
  color: string | null;
  volume_ml: number | null;
  price: number;
  active: boolean;
}

export type ProductVariantInput = Omit<ProductVariant, 'id'>;

export interface Inventory {
  variant_id: number;
  quantity: number;
  reserved: number;
  version: number;
  updated_at: string;
}

// Sobre en el servidor: { success, message, data }
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}
