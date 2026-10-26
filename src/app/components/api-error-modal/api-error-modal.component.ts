import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem, IonLabel } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { ApiDiagnosticsService } from '../../services/api-diagnostics.service';

/**
 * Modal generico de error de API: se cae sola (sin que la pantalla que la
 * usa tenga que llamarla) cada vez que ApiDiagnosticsService.lastCall()
 * registra una llamada fallida. Para usarla en cualquier pantalla que
 * consuma la API basta con poner <app-api-error-modal></app-api-error-modal>
 * una vez en su template.
 */
@Component({
  selector: 'app-api-error-modal',
  standalone: true,
  templateUrl: './api-error-modal.component.html',
  styleUrls: ['./api-error-modal.component.scss'],
  imports: [CommonModule, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem, IonLabel],
})
export class ApiErrorModalComponent {
  private diagnostics = inject(ApiDiagnosticsService);

  // Se "descarta" este error en particular con el boton de cerrar, para que
  // el modal no se vuelva a abrir solo hasta que llegue una llamada nueva.
  private dismissedTimestamp = signal<string | null>(null);

  public error = computed(() => {
    const last = this.diagnostics.lastCall();
    return last && !last.success ? last : null;
  });

  public isOpen = computed(() => {
    const err = this.error();
    return !!err && err.timestamp !== this.dismissedTimestamp();
  });

  constructor() {
    addIcons({ closeOutline });
  }

  close(): void {
    const err = this.error();
    this.dismissedTimestamp.set(err ? err.timestamp : null);
  }
}
