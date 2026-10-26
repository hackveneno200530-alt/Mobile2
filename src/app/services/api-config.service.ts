import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { apiClient } from './api-client';

// Clave con la que se guarda la configuracion de conexion (JSON) en el dispositivo.
const CONNECTION_CONFIG_KEY = 'api_connection_config';

// Carpeta fija donde vive la API dentro del servidor Apache (htdocs/9b-api).
const API_FOLDER = '9b-api';

/** Forma exacta del JSON que se persiste en Preferences. */
export interface ApiConnectionConfig {
  protocol: 'http' | 'https';
  ip: string;
  port: number;
}

/**
 * Permite configurar en tiempo de ejecucion a que servidor (protocolo, IP y
 * puerto) se conectan TODAS las llamadas a la API (login, register y
 * catalogo), sin recompilar la app. La configuracion se guarda como JSON
 * estructurado (ApiConnectionConfig), no como un texto suelto.
 *
 * Por que hace falta: "localhost" significa cosas distintas segun donde
 * corre la app.
 *  - Navegador (ionic serve):        localhost = la misma PC con XAMPP -> funciona.
 *  - Emulador de Android:            localhost = el propio emulador, NO la PC -> falla.
 *                                     Hay que usar el alias especial 10.0.2.2.
 *  - Celular fisico en la misma red: localhost = el propio celular -> falla.
 *                                     Hay que usar la IP LAN de la PC (ej. 192.168.1.103).
 */
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  // Configuracion activa (lo que lee la pantalla de "Origenes de datos").
  public connectionConfig = signal<ApiConnectionConfig>(this.buildDefaultConfig());

  constructor() {
    // Aplica la configuracion por defecto de inmediato (sincrono) y, si
    // habia una guardada de una sesion anterior, la sobreescribe al cargar.
    this.applyConfig(this.connectionConfig());
    void this.loadConfig();
  }

  /** Lee el JSON guardado en Preferences (si existe) y lo activa. */
  public async loadConfig(): Promise<void> {
    const { value } = await Preferences.get({ key: CONNECTION_CONFIG_KEY });
    if (!value) {
      return;
    }

    try {
      const parsed = JSON.parse(value) as ApiConnectionConfig;
      this.applyConfig(parsed);
    } catch {
      // JSON corrupto: se ignora y se queda con el valor por defecto.
    }
  }

  /**
   * Recibe lo que el usuario escribe en el input de la pantalla de login
   * (ej. "10.0.2.2", "192.168.1.103:80") y lo convierte en el JSON
   * estructurado { protocol, ip, port } antes de guardarlo.
   */
  public async setServerAddress(rawInput: string): Promise<void> {
    const clean = rawInput.trim();
    if (!clean) {
      return;
    }

    const [ip, portText] = clean.split(':');
    const config: ApiConnectionConfig = {
      protocol: 'http',
      ip,
      port: portText ? parseInt(portText, 10) : 80,
    };

    this.applyConfig(config);
    await Preferences.set({ key: CONNECTION_CONFIG_KEY, value: JSON.stringify(config) });
  }

  /** Texto para mostrar/editar en el input (ej. "10.0.2.2:80"). */
  public addressInput(): string {
    const { ip, port } = this.connectionConfig();
    return port === 80 ? ip : `${ip}:${port}`;
  }

  /** URL completa que esta usando ahora mismo el cliente Axios compartido. */
  public fullUrl(): string {
    const { protocol, ip, port } = this.connectionConfig();
    return `${protocol}://${ip}:${port}/${API_FOLDER}`;
  }

  /**
   * Actualiza el signal y la baseURL del cliente Axios compartido
   * (api-client.ts). Como AuthService y los servicios de catalogo usan
   * ese mismo apiClient, este cambio aplica a todas las llamadas de la
   * app de inmediato, sin reiniciarla.
   */
  private applyConfig(config: ApiConnectionConfig): void {
    this.connectionConfig.set(config);
    apiClient.defaults.baseURL = `${config.protocol}://${config.ip}:${config.port}/${API_FOLDER}`;
  }

  /**
   * Configuracion inicial inteligente: si la app corre dentro del
   * emulador/app nativa de Android, "localhost" nunca va a funcionar, asi
   * que se usa de entrada el alias 10.0.2.2 (host de la PC visto desde el
   * emulador). En navegador (web) se usa el host de environment.apiUrl.
   */
  private buildDefaultConfig(): ApiConnectionConfig {
    if (Capacitor.getPlatform() === 'android') {
      return { protocol: 'http', ip: '10.0.2.2', port: 80 };
    }

    const match = environment.apiUrl.match(/^(https?):\/\/([^:/]+)(?::(\d+))?/);
    return {
      protocol: (match?.[1] as 'http' | 'https') ?? 'http',
      ip: match?.[2] ?? 'localhost',
      port: match?.[3] ? parseInt(match[3], 10) : 80,
    };
  }
}
