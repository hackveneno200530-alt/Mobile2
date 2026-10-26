import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { apiClient } from './api-client';

// "La interfaz de objeto": la forma exacta del usuario que devuelve el backend.
export interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

// La forma del JSON completo que responden login.php y register.php.
export interface AuthResponse {
  success: boolean;
  message: string;
  user: AuthUser | null;
}

// Clave con la que se guarda la sesion en el almacenamiento del dispositivo (Preferences).
const AUTH_STORAGE_KEY = 'auth_user';

@Injectable({
  providedIn: 'root', // una sola instancia compartida por toda la app
})
export class AuthService {
  // "Y el objeto": signal reactivo con el usuario logueado (o null si no hay sesion).
  // Cualquier componente que lo lea se actualiza solo cuando esto cambia.
  public currentUser = signal<AuthUser | null>(null);

  constructor() {
    // Al crear el servicio (arranque de la app) intenta restaurar la sesion guardada.
    void this.loadSession();
  }

  /**
   * Consulta la sesion persistida en el dispositivo (Preferences) y, si existe,
   * actualiza currentUser. Se usa para que el usuario siga logueado aunque
   * cierre y vuelva a abrir la app.
   */
  public async loadSession(): Promise<void> {
    const { value } = await Preferences.get({ key: AUTH_STORAGE_KEY });
    if (!value) {
      return; // no habia sesion guardada
    }

    try {
      this.currentUser.set(JSON.parse(value) as AuthUser);
    } catch {
      // El dato guardado esta corrupto: se borra en vez de romper la app.
      await Preferences.remove({ key: AUTH_STORAGE_KEY });
    }
  }

  /** Inicia sesion: llama a POST /login.php y, si sale bien, guarda la sesion. */
  public async login(email: string, password: string): Promise<AuthResponse> {
    // "Donde manda a llamar/consume la API": usa el cliente Axios compartido
    // (api-client.ts), cuya baseURL puede cambiar en caliente desde
    // ApiConfigService (ej. al escribir la IP del servidor en el login).
    const { data } = await apiClient.post<AuthResponse>('/login.php', { email, password });
    if (data.success && data.user) {
      await this.persistSession(data.user);
    }
    return data;
  }

  /** Crea una cuenta: llama a POST /register.php y, si sale bien, guarda la sesion. */
  public async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/register.php', { name, email, password });
    if (data.success && data.user) {
      await this.persistSession(data.user);
    }
    return data;
  }

  /** Cierra sesion: borra la clave de Preferences y limpia el signal. */
  public async logout(): Promise<void> {
    await Preferences.remove({ key: AUTH_STORAGE_KEY });
    this.currentUser.set(null);
  }

  /**
   * "Donde registra las cosas" (version cliente): guarda el usuario tanto en
   * el signal (para que la UI reaccione ya) como en Preferences (para que
   * sobreviva a un reinicio de la app).
   */
  private async persistSession(user: AuthUser): Promise<void> {
    this.currentUser.set(user);
    await Preferences.set({ key: AUTH_STORAGE_KEY, value: JSON.stringify(user) });
  }
}
