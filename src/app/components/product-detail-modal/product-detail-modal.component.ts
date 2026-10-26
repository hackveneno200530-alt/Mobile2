import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
  IonBadge,
  IonChip,
  IonLabel,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  addOutline,
  removeOutline,
  cartOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  cubeOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { Product, ProductVariant } from '../../models/catalog.models';
import { ProductVariantService } from '../../services/product-variant.service';
import { LocalCartService } from '../../services/local-cart.service';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  templateUrl: './product-detail-modal.component.html',
  styleUrls: ['./product-detail-modal.component.scss'],
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonBadge,
    IonChip,
    IonLabel,
    IonSpinner,
  ],
})
export class ProductDetailModalComponent implements OnChanges {
  @Input() product: Product | null = null;
  @Input() isOpen = false;
  @Output() modalClosed = new EventEmitter<void>();

  private variantService = inject(ProductVariantService);
  private cart = inject(LocalCartService);
  private toastCtrl = inject(ToastController);

  public loadingVariants = signal<boolean>(false);
  public variants = signal<ProductVariant[]>([]);
  public selectedVariantId = signal<number | null>(null);
  public quantity = signal<number>(1);

  // Variante actualmente seleccionada
  public selectedVariant = computed(() => {
    const list = this.variants();
    const id = this.selectedVariantId();
    if (!id && list.length > 0) return list[0];
    return list.find((v) => v.id === id) ?? list[0] ?? null;
  });

  // Precio unitario activo
  public currentPrice = computed(() => {
    const v = this.selectedVariant();
    return v ? v.price : (this.product?.base_price ?? 0);
  });

  // Stock disponible de la variante descontando lo que ya esté en el carrito
  public availableStock = computed(() => {
    const v = this.selectedVariant();
    if (!v) return 0;
    const inCart = this.cart.getItem(v.id)?.quantity ?? 0;
    const realStock = v.stock ?? 0;
    return Math.max(0, realStock - inCart);
  });

  // Subtotal dinámico de la selección
  public subtotal = computed(() => this.currentPrice() * this.quantity());

  // Lista de atributos únicos para selectores
  public sizes = computed(() => {
    const list = this.variants();
    const unique = Array.from(new Set(list.map((v) => v.size).filter((s): s is string => !!s)));
    return unique;
  });

  public volumes = computed(() => {
    const list = this.variants();
    const unique = Array.from(
      new Set(
        list
          .map((v) => v.volume_ml)
          .filter((m): m is number => m !== null && m !== undefined)
      )
    );
    return unique;
  });

  public hasVolume = computed(() => this.volumes().length > 0);

  public colors = computed(() => {
    const list = this.variants();
    const unique = Array.from(new Set(list.map((v) => v.color).filter((c): c is string => !!c)));
    return unique;
  });

  constructor() {
    addIcons({
      closeOutline,
      addOutline,
      removeOutline,
      cartOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      cubeOutline,
      shieldCheckmarkOutline,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.product) {
      this.quantity.set(1);
      void this.loadVariants(this.product.id);
    }
  }

  private async loadVariants(productId: number): Promise<void> {
    this.loadingVariants.set(true);
    try {
      const res = await this.variantService.listWithCache(productId);
      this.variants.set(res.data);
      // Seleccionar automáticamente la primera con stock disponible
      const firstWithStock = res.data.find((v) => (v.stock ?? 0) > 0);
      if (firstWithStock) {
        this.selectedVariantId.set(firstWithStock.id);
      } else if (res.data.length > 0) {
        this.selectedVariantId.set(res.data[0].id);
      }
    } finally {
      this.loadingVariants.set(false);
    }
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariantId.set(variant.id);
    this.quantity.set(1);
  }

  selectBySize(size: string): void {
    const match = this.variants().find((v) => v.size === size);
    if (match) {
      this.selectVariant(match);
    }
  }

  selectByVolume(vol: number): void {
    const match = this.variants().find((v) => v.volume_ml === vol);
    if (match) {
      this.selectVariant(match);
    }
  }

  selectByColor(color: string): void {
    const current = this.selectedVariant();
    const match =
      this.variants().find(
        (v) => v.color === color && (current?.size ? v.size === current.size : true)
      ) ?? this.variants().find((v) => v.color === color);
    if (match) {
      this.selectVariant(match);
    }
  }

  incrementQty(): void {
    if (this.quantity() < this.availableStock()) {
      this.quantity.update((q) => q + 1);
    }
  }

  decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  async addToCart(): Promise<void> {
    const v = this.selectedVariant();
    const p = this.product;
    if (!v || !p) return;

    if (this.availableStock() <= 0) {
      const toast = await this.toastCtrl.create({
        message: 'No hay stock disponible para agregar esta variante.',
        duration: 2500,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
      return;
    }

    await this.cart.addItem({
      variantId: v.id,
      productId: p.id,
      name: p.name,
      sku: v.sku,
      size: v.size,
      color: v.color,
      volume_ml: v.volume_ml,
      price: v.price,
      quantity: this.quantity(),
      maxStock: v.stock ?? 99,
      imageUrl: p.image_url,
    });

    const toast = await this.toastCtrl.create({
      message: `¡${p.name} agregado al carrito!`,
      duration: 2000,
      color: 'dark',
      position: 'bottom',
    });
    await toast.present();

    this.close();
  }

  close(): void {
    this.modalClosed.emit();
  }
}
