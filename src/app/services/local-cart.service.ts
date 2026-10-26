import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface CartItem {
  variantId: number;
  productId: number;
  name: string;
  sku?: string;
  size?: string | null;
  color?: string | null;
  volume_ml?: number | null;
  price: number;
  quantity: number;
  maxStock: number;
  imageUrl?: string | null;
}

export interface AddToCartInput {
  variantId: number;
  productId: number;
  name: string;
  sku?: string;
  size?: string | null;
  color?: string | null;
  volume_ml?: number | null;
  price: number;
  quantity?: number;
  maxStock: number;
  imageUrl?: string | null;
}

const CART_STORAGE_KEY = 'delrio_cart';

@Injectable({
  providedIn: 'root',
})
export class LocalCartService {
  // Estado reactivo: lista de ítems en el carrito
  public items = signal<CartItem[]>([]);

  // Contador total de piezas (para el badge de tabs)
  public totalCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );

  // Subtotal financiero de los productos
  public subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  // Envío gratis en compras mayores a $999 MXN
  public shippingCost = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    return sub >= 999 ? 0 : 99;
  });

  // Total final con envío incluido
  public total = computed(() => this.subtotal() + this.shippingCost());

  constructor() {
    void this.loadCart();
  }

  /** Carga inicial del carrito desde Preferences */
  public async loadCart(): Promise<void> {
    const { value } = await Preferences.get({ key: CART_STORAGE_KEY });
    if (!value) {
      this.items.set([]);
      return;
    }

    try {
      const parsed = JSON.parse(value) as CartItem[];
      // Migración defensiva: asegurar que cada ítem tenga variantId
      const sanitized = parsed.map((item) => ({
        ...item,
        variantId: item.variantId ?? (item as unknown as { productId: number }).productId,
        maxStock: item.maxStock ?? 99,
      }));
      this.items.set(sanitized);
    } catch {
      await Preferences.remove({ key: CART_STORAGE_KEY });
      this.items.set([]);
    }
  }

  /** Busca si una variante ya se encuentra en el carrito */
  public getItem(variantId: number): CartItem | undefined {
    return this.items().find((item) => item.variantId === variantId);
  }

  /**
   * Agrega una variante al carrito respetando el tope de maxStock.
   */
  public async addItem(
    input: AddToCartInput
  ): Promise<{ added: boolean; currentQuantity: number; maxReached: boolean }> {
    const current = this.items();
    const qtyToAdd = input.quantity ?? 1;
    const existing = current.find((item) => item.variantId === input.variantId);

    let updated: CartItem[];
    let newQty: number;
    let maxReached = false;

    if (existing) {
      newQty = existing.quantity + qtyToAdd;
      if (newQty >= existing.maxStock) {
        newQty = existing.maxStock;
        maxReached = true;
      }
      updated = current.map((item) =>
        item.variantId === input.variantId ? { ...item, quantity: newQty } : item
      );
    } else {
      newQty = Math.min(qtyToAdd, input.maxStock);
      maxReached = newQty >= input.maxStock;
      const newItem: CartItem = {
        variantId: input.variantId,
        productId: input.productId,
        name: input.name,
        sku: input.sku,
        size: input.size,
        color: input.color,
        volume_ml: input.volume_ml,
        price: input.price,
        quantity: newQty,
        maxStock: input.maxStock,
        imageUrl: input.imageUrl,
      };
      updated = [...current, newItem];
    }

    await this.persist(updated);
    return { added: true, currentQuantity: newQty, maxReached };
  }

  /**
   * Actualiza la cantidad de una variante específica (con tope de stock).
   */
  public async updateQuantity(variantId: number, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.removeItem(variantId);
      return;
    }

    const current = this.items();
    const updated = current.map((item) => {
      if (item.variantId === variantId) {
        const capped = Math.min(quantity, item.maxStock);
        return { ...item, quantity: capped };
      }
      return item;
    });

    await this.persist(updated);
  }

  /** Elimina una variante del carrito */
  public async removeItem(variantId: number): Promise<void> {
    const updated = this.items().filter((item) => item.variantId !== variantId);
    await this.persist(updated);
  }

  /** Vacía el carrito por completo */
  public async clearCart(): Promise<void> {
    await Preferences.remove({ key: CART_STORAGE_KEY });
    this.items.set([]);
  }

  private async persist(items: CartItem[]): Promise<void> {
    this.items.set(items);
    await Preferences.set({ key: CART_STORAGE_KEY, value: JSON.stringify(items) });
  }
}
