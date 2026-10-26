import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  IonSearchbar,
  IonChip,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonSkeletonText,
  IonToggle,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  logOutOutline,
  personCircleOutline,
  filterOutline,
  refreshOutline,
  alertCircleOutline,
  arrowUpOutline,
  arrowDownOutline,
  searchOutline,
  closeCircleOutline,
  sparklesOutline,
  bagHandleOutline,
} from 'ionicons/icons';
import { Product, Category } from '../models/catalog.models';
import { ProductService } from '../services/product.service';
import { CategoryService } from '../services/category.service';
import { AuthService } from '../services/auth.service';
import { NetworkStatusService } from '../services/network-status.service';
import { ProductDetailModalComponent } from '../components/product-detail-modal/product-detail-modal.component';

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonBadge,
    IonSearchbar,
    IonChip,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSkeletonText,
    IonToggle,
    ProductDetailModalComponent,
  ],
})
export class Tab1Page implements OnInit {
  public auth = inject(AuthService);
  public network = inject(NetworkStatusService);
  private router = inject(Router);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);

  // Estado del catálogo
  public loading = signal<boolean>(true);
  public isRefreshing = signal<boolean>(false);
  public products = signal<Product[]>([]);
  public categories = signal<Category[]>([]);

  // Filtros reactivos
  public searchQuery = signal<string>('');
  public selectedCategoryId = signal<number | null>(null);
  public sortOrder = signal<'default' | 'price_asc' | 'price_desc'>('default');
  public onlyInStock = signal<boolean>(false);

  // Modal de detalle y selector de variantes
  public selectedProduct = signal<Product | null>(null);
  public isModalOpen = signal<boolean>(false);

  // Productos filtrados y ordenados mediante computed()
  public filteredProducts = computed(() => {
    let result = [...this.products()];
    const query = this.searchQuery().trim().toLowerCase();
    const catId = this.selectedCategoryId();
    const inStock = this.onlyInStock();
    const sort = this.sortOrder();

    // Filtro por categoría inteligente (por ID o por nombre normalizado)
    if (catId !== null) {
      const selectedCat = this.categories().find((c) => c.id === catId);
      const targetName = selectedCat?.name?.toLowerCase().trim();
      const targetSlug = selectedCat?.slug?.toLowerCase().trim();
      result = result.filter((p) => {
        if (p.category_id === catId) return true;
        const pCatName = p.category_name?.toLowerCase().trim();
        if (targetName && pCatName === targetName) return true;
        if (targetSlug && pCatName === targetSlug) return true;
        return false;
      });
    }

    // Filtro por texto (nombre, marca o descripción)
    if (query !== '') {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.brand && p.brand.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Filtro solo con stock disponible
    if (inStock) {
      result = result.filter((p) => (p.total_stock ?? 1) > 0);
    }

    // Ordenamiento por precio
    if (sort === 'price_asc') {
      result.sort((a, b) => a.base_price - b.base_price);
    } else if (sort === 'price_desc') {
      result.sort((a, b) => b.base_price - a.base_price);
    }

    return result;
  });

  constructor() {
    addIcons({
      cartOutline,
      logOutOutline,
      personCircleOutline,
      filterOutline,
      refreshOutline,
      alertCircleOutline,
      arrowUpOutline,
      arrowDownOutline,
      searchOutline,
      closeCircleOutline,
      sparklesOutline,
      bagHandleOutline,
    });
  }

  ngOnInit(): void {
    void this.loadCatalog();
  }

  async loadCatalog(forceRefresh = false): Promise<void> {
    if (!forceRefresh) {
      this.loading.set(true);
    }
    try {
      const [catsRes, prodsRes] = await Promise.all([
        this.categoryService.listWithCache(forceRefresh),
        this.productService.listWithCache(undefined, forceRefresh),
      ]);
      this.categories.set(catsRes.data);
      this.products.set(prodsRes.data);

      if (prodsRes.fromCache) {
        this.productService.list().then((liveProds) => {
          if (liveProds && liveProds.length > 0) {
            this.products.set(liveProds);
          }
        }).catch(() => {});
      }
    } finally {
      this.loading.set(false);
      this.isRefreshing.set(false);
    }
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    this.isRefreshing.set(true);
    await this.loadCatalog(true);
    (event.target as HTMLIonRefresherElement).complete();
  }

  onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value ?? '').toString();
    this.searchQuery.set(value);
  }

  selectCategory(catId: number | null): void {
    this.selectedCategoryId.set(catId);
  }

  toggleSort(order: 'price_asc' | 'price_desc'): void {
    if (this.sortOrder() === order) {
      this.sortOrder.set('default');
    } else {
      this.sortOrder.set(order);
    }
  }

  onStockToggle(event: CustomEvent): void {
    this.onlyInStock.set(event.detail.checked);
  }

  openProductDetail(product: Product): void {
    this.selectedProduct.set(product);
    this.isModalOpen.set(true);
  }

  closeProductDetail(): void {
    this.isModalOpen.set(false);
    this.selectedProduct.set(null);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategoryId.set(null);
    this.sortOrder.set('default');
    this.onlyInStock.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  goToLogin(): void {
    this.router.navigateByUrl('/login');
  }
}
