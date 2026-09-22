import { Component, computed, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonNote } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, removeCircleOutline, trashOutline } from 'ionicons/icons';
import { LocalCartService } from '../services/local-cart.service';

@Component({
  selector: 'app-tab3',
  standalone: true,
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonNote],
})
export class Tab3Page {
  public cart = inject(LocalCartService);

  public total = computed(() => this.cart.items().reduce((sum, item) => sum + item.price * item.quantity, 0));

  constructor() {
    addIcons({ addCircleOutline, removeCircleOutline, trashOutline });
  }

  increment(productId: number, currentQuantity: number): void {
    void this.cart.updateQuantity(productId, currentQuantity + 1);
  }

  decrement(productId: number, currentQuantity: number): void {
    if (currentQuantity <= 1) {
      return; // usa el boton de eliminar para quitarlo del carrito
    }
    void this.cart.updateQuantity(productId, currentQuantity - 1);
  }

  remove(productId: number): void {
    void this.cart.removeItem(productId);
  }
}
