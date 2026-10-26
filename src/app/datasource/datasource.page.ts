import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote, IonBadge, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline } from 'ionicons/icons';
import { ApiConfigService } from '../services/api-config.service';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/catalog.models';

/**
 * Pantalla de "Origenes de datos": muestra en texto plano el JSON que
 * ApiConfigService guarda en Preferences (protocolo, IP, puerto) y la URL
 * completa resultante, y de paso demuestra la estrategia de cache: trae
 * las categorias reales de la API y, si la peticion falla (sin conexion),
 * cae a la ultima copia guardada en el dispositivo en vez de romperse.
 */
@Component({
  selector: 'app-datasource',
  standalone: true,
  templateUrl: './datasource.page.html',
  styleUrls: ['./datasource.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote, IonBadge, IonButton, IonIcon],
})
export class DatasourcePage {
  public config = inject(ApiConfigService);
  private categoryService = inject(CategoryService);

  public categories = signal<Category[]>([]);
  public loadingCategories = signal(false);
  public fromCache = signal(false);
  public cachedAt = signal<string | null>(null);
  public categoriesError = signal<string | null>(null);

  constructor() {
    addIcons({ refreshOutline });
    void this.loadCategories();
  }

  /**
   * Prueba de funcionamiento sin conexion: con internet, trae las
   * categorias en vivo y las guarda. Sin internet, listWithCache()
   * regresa automaticamente la ultima copia guardada.
   */
  async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    this.categoriesError.set(null);
    try {
      const result = await this.categoryService.listWithCache();
      this.categories.set(result.data);
      this.fromCache.set(result.fromCache);
      this.cachedAt.set(result.cachedAt);
    } catch {
      // Nunca hubo nada guardado Y la peticion en vivo fallo: no hay nada que mostrar.
      this.categoriesError.set('No se pudieron cargar las categorias y no hay ninguna copia guardada.');
    } finally {
      this.loadingCategories.set(false);
    }
  }
}
