import { Injectable, signal } from '@angular/core';
import axios, { AxiosInstance } from 'axios';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: AuthUser | null;
}

const AUTH_STORAGE_KEY = 'auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public currentUser = signal<AuthUser | null>(null);

  private http: AxiosInstance = axios.create({
    baseURL: environment.apiUrl,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor() {
    void this.loadSession();
  }

  /** Lee la sesion persistida (si existe) y actualiza el signal currentUser. */
  public async loadSession(): Promise<void> {
    const { value } = await Preferences.get({ key: AUTH_STORAGE_KEY });
    if (!value) {
      return;
    }

    try {
      this.currentUser.set(JSON.parse(value) as AuthUser);
    } catch {
      await Preferences.remove({ key: AUTH_STORAGE_KEY });
    }
  }

  public async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/login.php', { email, password });
    if (data.success && data.user) {
      await this.persistSession(data.user);
    }
    return data;
  }

  public async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/register.php', { name, email, password });
    if (data.success && data.user) {
      await this.persistSession(data.user);
    }
    return data;
  }

  public async logout(): Promise<void> {
    await Preferences.remove({ key: AUTH_STORAGE_KEY });
    this.currentUser.set(null);
  }

  private async persistSession(user: AuthUser): Promise<void> {
    this.currentUser.set(user);
    await Preferences.set({ key: AUTH_STORAGE_KEY, value: JSON.stringify(user) });
  }
}
