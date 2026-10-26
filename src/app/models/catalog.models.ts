// Contrato de datos entre Angular y el backend PHP/MySQL de Del Río Caps.
// Alineado con las tablas en api/schema_ecommerce.sql.

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
  image_url?: string | null;
  category_name?: string | null;
  total_stock?: number;
  created_at: string;
  updated_at: string;
}

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>;

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  size: string | null;      // talla (gorras: '7 1/4', ropa: 'M', calzado: '27')
  color: string | null;     // color o acabado
  volume_ml: number | null; // mililitros (perfumes/decants)
  price: number;
  active: boolean;
  stock?: number;           // Stock disponible en inventario (JOIN con inventory)
  reserved?: number;        // Stock apartado
}

export type ProductVariantInput = Omit<ProductVariant, 'id' | 'stock' | 'reserved'>;

export interface Inventory {
  variant_id: number;
  quantity: number;
  reserved: number;
  version: number;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface CacheResult<T> {
  data: T;
  fromCache: boolean;
  cachedAt: string | null;
}

export type ProductsResult = CacheResult<Product[]>;
export type ProductVariantsResult = CacheResult<ProductVariant[]>;
export type CategoriesResult = CacheResult<Category[]>;

// -------------------------------------------------------------
// MODELOS DE PEDIDOS Y CHECKOUT (api/orders/)
// -------------------------------------------------------------

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  product_name?: string;
  size?: string | null;
  color?: string | null;
  volume_ml?: number | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  folio?: string;
  user_id: number;
  shipping_address_id: number | null;
  billing_address_id: number | null;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  total: number;
  payment_method?: 'cash_on_delivery' | 'bank_transfer' | 'card';
  delivery_type?: 'store_pickup' | 'home_delivery';
  delivery_notes?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  shipping_address?: string | null;
  payment_ref?: string | null;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CheckoutItemInput {
  variant_id: number;
  quantity: number;
  unit_price: number;
}

export interface CheckoutInput {
  user_id: number;
  delivery_type: 'store_pickup' | 'home_delivery';
  recipient_name: string;
  recipient_phone: string;
  shipping_address?: string;
  payment_method: 'cash_on_delivery' | 'bank_transfer';
  notes?: string;
  items: CheckoutItemInput[];
}

export interface CheckoutResult {
  order_id: number;
  folio: string;
  total: number;
  status: OrderStatus;
  created_at: string;
}
