import axios, { AxiosError, AxiosResponse } from 'axios';
import { signal } from '@angular/core';
import { environment } from '../../environments/environment';

// Cliente Axios unico y compartido por TODOS los servicios que consumen la
// API (auth.service.ts, category/product/product-variant/inventory.service.ts),
// para no repetir la configuracion de baseURL/headers en cada uno y para que
// ApiConfigService pueda cambiar la IP de destino en un solo lugar.
export const apiClient = axios.create({
  baseURL: environment.apiUrl, // ej: http://localhost/9b-api
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Snapshot de la ultima peticion/respuesta de la API, para mostrar en el
 * diagnostico de la pantalla de login y en el modal de error de cualquier
 * pantalla que consuma la API.
 */
export interface ApiCallDiagnostics {
  timestamp: string;
  method: string;
  url: string; // URL completa, ej: http://10.0.2.2/9b-api/login.php
  payload: unknown; // body que se mando (passwords ya enmascaradas)
  requestHeaders: Record<string, string>;
  online: boolean; // navigator.onLine al momento de la peticion
  success: boolean;
  statusCode: number | null;
  responseHeaders: Record<string, string> | null;
  message: string; // resumen legible del resultado
}

// Signal reactivo con el resultado de la ultima llamada a la API. Se llena
// solo via los interceptores de abajo, nunca hace falta tocarlo a mano
// desde los servicios (login, register, catalogo, etc.).
export const lastApiCall = signal<ApiCallDiagnostics | null>(null);

/** Oculta valores de campos sensibles (password) antes de mostrarlos en pantalla. */
function maskPayload(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const clone: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  if ('password' in clone) {
    clone['password'] = '••••••••';
  }
  return clone;
}

function headersToRecord(headers: unknown): Record<string, string> {
  if (!headers) {
    return {};
  }
  // AxiosHeaders se comporta como objeto plano para efectos de iteracion.
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    result[key] = String(value);
  }
  return result;
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    lastApiCall.set({
      timestamp: new Date().toISOString(),
      method: (response.config.method ?? 'get').toUpperCase(),
      url: (response.config.baseURL ?? '') + (response.config.url ?? ''),
      payload: maskPayload(response.config.data ? JSON.parse(response.config.data) : null),
      requestHeaders: headersToRecord(response.config.headers),
      online: navigator.onLine,
      success: true,
      statusCode: response.status,
      responseHeaders: headersToRecord(response.headers),
      message: 'Respuesta recibida correctamente.',
    });
    return response;
  },
  (error: AxiosError) => {
    const config = error.config;
    let payload: unknown = null;
    try {
      payload = config?.data ? JSON.parse(config.data as string) : null;
    } catch {
      payload = config?.data ?? null;
    }

    lastApiCall.set({
      timestamp: new Date().toISOString(),
      method: (config?.method ?? 'get').toUpperCase(),
      url: (config?.baseURL ?? '') + (config?.url ?? ''),
      payload: maskPayload(payload),
      requestHeaders: headersToRecord(config?.headers),
      online: navigator.onLine,
      success: false,
      statusCode: error.response?.status ?? null,
      responseHeaders: error.response ? headersToRecord(error.response.headers) : null,
      // Manejo de errores diferenciado: si el dispositivo esta sin internet
      // el problema es la red, no el servidor -- son causas y soluciones
      // distintas y el usuario deberia saber cual es cual.
      message: !navigator.onLine
        ? 'Sin conexion a internet en el dispositivo.'
        : error.response
          ? `El servidor respondio con error ${error.response.status}.`
          : 'No se pudo conectar con el servidor (sin respuesta).',
    });
    return Promise.reject(error);
  },
);
