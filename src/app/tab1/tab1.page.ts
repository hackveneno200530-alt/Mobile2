import { Component, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonNote } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cartOutline } from 'ionicons/icons';
import { LocalCartService } from '../services/local-cart.service';

interface MockProduct {
  productId: number;
  name: string;
  price: number;
  category: string;
}

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonNote],
})
export class Tab1Page {
  public cart = inject(LocalCartService);

  // Catalogo mockeado: no depende de que la API PHP (api/catalog/products.php)
  // este corriendo, para poder probar el Alta del carrito de forma aislada.
  public mockProducts: MockProduct[] = [
    { productId: 1, name: 'Gorra Snapback Negra', price: 399, category: 'Gorras' },
    { productId: 2, name: 'Playera Oversize Blanca', price: 459, category: 'Ropa' },
    { productId: 3, name: 'Tenis Urbano Gris', price: 1299, category: 'Calzado' },
    { productId: 4, name: 'Perfume Del Rio 100ml', price: 899, category: 'Perfumes' },
  ];

  constructor() {
    addIcons({ cartOutline });
  }

  addToCart(product: MockProduct): void {
    void this.cart.addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
    });
  }
}
