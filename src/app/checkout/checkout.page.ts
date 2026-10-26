import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonContent,
  IonBadge,
  IonSpinner,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  bagCheckOutline,
  storefrontOutline,
  locationOutline,
  cashOutline,
  cardOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  receiptOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { isAxiosError } from 'axios';
import { LocalCartService } from '../services/local-cart.service';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { CheckoutResult } from '../models/catalog.models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonBadge,
    IonSpinner,
  ],
})
export class CheckoutPage implements OnInit {
  public cart = inject(LocalCartService);
  public auth = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  // Formulario reactivo
  public deliveryType = signal<'store_pickup' | 'home_delivery'>('store_pickup');
  public recipientName = signal<string>('');
  public recipientPhone = signal<string>('');
  public shippingAddress = signal<string>('');
  public paymentMethod = signal<'cash_on_delivery' | 'bank_transfer'>('cash_on_delivery');
  public notes = signal<string>('');

  public processing = signal<boolean>(false);
  public confirmedOrder = signal<CheckoutResult | null>(null);

  constructor() {
    addIcons({
      bagCheckOutline,
      storefrontOutline,
      locationOutline,
      cashOutline,
      cardOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      receiptOutline,
      arrowForwardOutline,
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.recipientName.set(`${user.first_name} ${user.last_name}`.trim());
    }

    if (this.cart.items().length === 0 && !this.confirmedOrder()) {
      this.router.navigateByUrl('/tabs/tab3');
    }
  }

  setDeliveryType(type: 'store_pickup' | 'home_delivery'): void {
    this.deliveryType.set(type);
  }

  setPaymentMethod(method: 'cash_on_delivery' | 'bank_transfer'): void {
    this.paymentMethod.set(method);
  }

  async submitOrder(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this.router.navigateByUrl('/login');
      return;
    }

    if (!this.recipientName().trim() || !this.recipientPhone().trim()) {
      this.showAlert('Campos obligatorios', 'Por favor ingresa el nombre de quien recibe y un teléfono de contacto.');
      return;
    }

    if (this.deliveryType() === 'home_delivery' && !this.shippingAddress().trim()) {
      this.showAlert('Dirección requerida', 'Ingresa la calle, número, colonia y código postal para el envío.');
      return;
    }

    this.processing.set(true);

    try {
      const itemsPayload = this.cart.items().map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const result = await this.orderService.checkout({
        user_id: user.id,
        delivery_type: this.deliveryType(),
        recipient_name: this.recipientName().trim(),
        recipient_phone: this.recipientPhone().trim(),
        shipping_address: this.shippingAddress().trim(),
        payment_method: this.paymentMethod(),
        notes: this.notes().trim(),
        items: itemsPayload,
      });

      // Éxito: vaciar carrito y desplegar Ticket de confirmación
      await this.cart.clearCart();
      this.confirmedOrder.set(result);
    } catch (err: unknown) {
      if (isAxiosError<{ message?: string; data?: { conflict_variant_id?: number } }>(err) && err.response) {
        if (err.response.status === 409) {
          // Conflicto de inventario (ACID FOR UPDATE detectó stock insuficiente)
          await this.showStockConflictAlert(err.response.data.message || 'Una variante ya no cuenta con stock disponible.');
          return;
        }
        this.showAlert('Error en pedido', err.response.data.message || 'No se pudo procesar tu orden.');
      } else {
        this.showAlert('Error de conexión', 'No se pudo conectar con el servidor para confirmar tu compra.');
      }
    } finally {
      this.processing.set(false);
    }
  }

  private async showStockConflictAlert(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Inventario agotado',
      subHeader: 'Conflicto de stock en tiempo real',
      message,
      buttons: [
        {
          text: 'Ajustar Carrito',
          handler: () => {
            this.router.navigateByUrl('/tabs/tab3');
          },
        },
      ],
    });
    await alert.present();
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Entendido'],
    });
    await alert.present();
  }

  goToOrders(): void {
    this.router.navigateByUrl('/tabs/orders');
  }

  goToCatalog(): void {
    this.router.navigateByUrl('/tabs/tab1');
  }
}
