import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  storefrontOutline,
  images,
  cartOutline,
  serverOutline,
  receiptOutline,
} from 'ionicons/icons';
import { LocalCartService } from '../services/local-cart.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
})
export class TabsPage {
  public cart = inject(LocalCartService);

  constructor() {
    addIcons({ storefrontOutline, images, cartOutline, serverOutline, receiptOutline });
  }
}
