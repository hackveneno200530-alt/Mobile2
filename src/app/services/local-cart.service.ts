import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

/** Datos minimos para agregar un producto al carrito (sin cantidad). */
export type CartProductInput = Omit<CartItem, 'quantity'>;

const CART_STORAGE_KEY = 'delrio_cart';

@Injectable({
  providedIn: 'root',
})
export class LocalCartService {
  public items = signal<CartItem[]>([]);

  constructor() {
    void this.loadCart();
  }

  /** Consulta: lee 'delrio_cart' de Preferences y actualiza el signal items. */
  public async loadCart(): Promise<void> {
    const { value } = await Preferences.get({ key: CART_STORAGE_KEY });
    if (!value) {
      this.items.set([]);
      return;
    }

    try {
      this.items.set(JSON.parse(value) as CartItem[]);
    } catch {
      await Preferences.remove({ key: CART_STORAGE_KEY });
      this.items.set([]);
    }
  }

  /** Alta: agrega el producto, o si ya existe le suma 1 a la cantidad. */
  public async addItem(product: CartProductInput): Promise<void> {
    const current = this.items();
    const existing = current.find((item) => item.productId === product.productId);

    const updated = existing
      ? current.map((item) =>
          item.productId === product.productId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      : [...current, { ...product, quantity: 1 }];

    await this.persist(updated);
  }

  /** Modificacion: cambia la cantidad de un producto ya presente en el carrito. */
  public async updateQuantity(productId: number, newQuantity: number): Promise<void> {
    const updated = this.items().map((item) =>
      item.productId === productId ? { ...item, quantity: newQuantity } : item,
    );

    await this.persist(updated);
  }

  /** Eliminacion: quita un unico producto del carrito. */
  public async removeItem(productId: number): Promise<void> {
    const updated = this.items().filter((item) => item.productId !== productId);
    await this.persist(updated);
  }

  /** Eliminacion: vacia el carrito por completo. */
  public async clearCart(): Promise<void> {
    await Preferences.remove({ key: CART_STORAGE_KEY });
    this.items.set([]);
  }

  private async persist(items: CartItem[]): Promise<void> {
    this.items.set(items);
    await Preferences.set({ key: CART_STORAGE_KEY, value: JSON.stringify(items) });
  }
}
