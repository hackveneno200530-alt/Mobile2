import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Deteccion de estado de conexion: a diferencia de navigator.onLine (que
 * solo se consulta en el momento de una peticion), este servicio escucha
 * los cambios de conectividad en vivo via @capacitor/network, que funciona
 * igual de bien en el navegador que dentro de la app nativa de Android.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  // Signal reactivo: cualquier componente que lo lea (ej. el banner global
  // en app.component.html) se actualiza solo cuando cambia la conectividad.
  public online = signal<boolean>(true);

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    // Estado inicial (al abrir la app).
    const status = await Network.getStatus();
    this.online.set(status.connected);

    // Se actualiza en vivo cada vez que el dispositivo gana o pierde señal
    // (wifi, datos moviles, modo avion, etc.), sin tener que recargar la app.
    Network.addListener('networkStatusChange', (status) => {
      this.online.set(status.connected);
    });
  }
}
