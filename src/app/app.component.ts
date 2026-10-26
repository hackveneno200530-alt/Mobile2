import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { NetworkStatusService } from './services/network-status.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [CommonModule, IonApp, IonRouterOutlet],
})
export class AppComponent {
  // Se expone aqui (componente raiz) para que el banner de "sin conexion"
  // se vea en CUALQUIER pantalla de la app, no solo en el login.
  public network = inject(NetworkStatusService);

  constructor() {}
}
