import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonButton,
  IonIcon,
  IonBadge,
  IonButtons,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  removeOutline,
  trashOutline,
  bagCheckOutline,
  bagHandleOutline,
  alertCircleOutline,
  arrowForwardOutline,
  chevronForwardOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { LocalCartService } from '../services/local-cart.service';
import { NetworkStatusService } from '../services/network-status.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tab3',
  standalone: true,
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonButton,
    IonIcon,
    IonBadge,
    IonButtons,
  ],
})
export class Tab3Page {
  public cart = inject(LocalCartService);
  public network = inject(NetworkStatusService);
  public auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({
      addOutline,
      removeOutline,
      trashOutline,
      bagCheckOutline,
      bagHandleOutline,
      alertCircleOutline,
      arrowForwardOutline,
      chevronForwardOutline,
      sparklesOutline,
    });
  }

  increment(variantId: number, currentQty: number, maxStock: number): void {
    if (currentQty < maxStock) {
      void this.cart.updateQuantity(variantId, currentQty + 1);
    }
  }

  decrement(variantId: number, currentQty: number): void {
    if (currentQty > 1) {
      void this.cart.updateQuantity(variantId, currentQty - 1);
    }
  }

  remove(variantId: number): void {
    void this.cart.removeItem(variantId);
  }

  clear(): void {
    void this.cart.clearCart();
  }

  goToExplore(): void {
    this.router.navigateByUrl('/tabs/tab1');
  }

  proceedToCheckout(): void {
    if (!this.network.online()) {
      return;
    }

    if (!this.auth.currentUser()) {
      // Redirigir al login si no ha iniciado sesión, conservando el carrito en Preferences
      this.router.navigateByUrl('/login');
      return;
    }

    this.router.navigateByUrl('/checkout');
  }
}
