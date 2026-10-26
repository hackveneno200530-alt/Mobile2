import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface CacheEntry<T> {
  data: T;
  cachedAt: string; // ISO timestamp de cuando se guardo
}

/**
 * Estrategia de cache/almacenamiento temporal generica: guarda la ultima
 * respuesta exitosa de cualquier llamada a la API en Preferences, para
 * poder mostrarla cuando la peticion en vivo falla (sin conexion, servidor
 * caido, etc.) en vez de dejar la pantalla vacia o rota.
 *
 * No esta atada a ningun endpoint en particular: cualquier servicio puede
 * usarla (ver CategoryService.listWithCache() como ejemplo).
 */
@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly keyPrefix = 'cache_';

  /** Guarda data bajo key, junto con la hora en que se guardo. */
  public async set<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = { data, cachedAt: new Date().toISOString() };
    await Preferences.set({ key: this.keyPrefix + key, value: JSON.stringify(entry) });
  }

  /** Lee lo ultimo guardado bajo key, o null si nunca se guardo nada. */
  public async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const { value } = await Preferences.get({ key: this.keyPrefix + key });
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  /** Elimina una clave de cache especifica. */
  public async clear(key: string): Promise<void> {
    await Preferences.remove({ key: this.keyPrefix + key });
  }

  /** Limpia todo el almacenamiento de cache. */
  public async clearAll(): Promise<void> {
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      if (key.startsWith(this.keyPrefix)) {
        await Preferences.remove({ key });
      }
    }
  }
}
