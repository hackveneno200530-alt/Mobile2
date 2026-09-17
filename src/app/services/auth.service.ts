import { Injectable, signal } from '@angular/core';
import axios, { AxiosInstance } from 'axios';
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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public currentUser = signal<AuthUser | null>(null);

  private http: AxiosInstance = axios.create({
    baseURL: environment.apiUrl,
    headers: { 'Content-Type': 'application/json' },
  });

  public async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/login.php', { email, password });
    if (data.success) {
      this.currentUser.set(data.user);
    }
    return data;
  }

  public async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/register.php', { name, email, password });
    if (data.success) {
      this.currentUser.set(data.user);
    }
    return data;
  }
}
