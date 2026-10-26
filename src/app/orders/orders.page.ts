import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  receiptOutline,
  bagHandleOutline,
  personCircleOutline,
  logOutOutline,
  timeOutline,
  checkmarkCircleOutline,
  chevronDownOutline,
  chevronUpOutline,
  carOutline,
  storefrontOutline,
  cashOutline,
  cardOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { Order } from '../models/catalog.models';

@Component({
  selector: 'app-orders',
  standalone: true,
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
  ],
})
export class OrdersPage implements OnInit {
  public auth = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  public loading = signal<boolean>(true);
  public orders = signal<Order[]>([]);
  public fromCache = signal<boolean>(false);
  public cachedAt = signal<string | null>(null);
  public expandedOrderId = signal<number | null>(null);

  constructor() {
    addIcons({
      receiptOutline,
      bagHandleOutline,
      personCircleOutline,
      logOutOutline,
      timeOutline,
      checkmarkCircleOutline,
      chevronDownOutline,
      chevronUpOutline,
      carOutline,
      storefrontOutline,
      cashOutline,
      cardOutline,
      refreshOutline,
    });
  }

  ngOnInit(): void {
    void this.loadOrders();
  }

  ionViewWillEnter(): void {
    void this.loadOrders(true);
  }

  async loadOrders(forceRefresh = false): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    if (!forceRefresh) {
      this.loading.set(true);
    }

    try {
      const res = await this.orderService.listWithCache(user.id, forceRefresh);
      this.orders.set(res.data);
      this.fromCache.set(res.fromCache);
      this.cachedAt.set(res.cachedAt);
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.loadOrders(true);
    (event.target as HTMLIonRefresherElement).complete();
  }

  toggleExpand(orderId: number): void {
    if (this.expandedOrderId() === orderId) {
      this.expandedOrderId.set(null);
    } else {
      this.expandedOrderId.set(orderId);
    }
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'paid':
      case 'delivered':
        return 'success';
      case 'processing':
      case 'shipped':
        return 'primary';
      case 'cancelled':
      case 'refunded':
        return 'danger';
      case 'pending':
      default:
        return 'warning';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'paid':
        return 'Pagado';
      case 'processing':
        return 'En Preparación';
      case 'shipped':
        return 'Enviado';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Cancelado';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  }

  goToLogin(): void {
    this.router.navigateByUrl('/login');
  }

  goToCatalog(): void {
    this.router.navigateByUrl('/tabs/tab1');
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
