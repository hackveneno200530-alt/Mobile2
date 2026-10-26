import { Injectable } from '@angular/core';
import { lastApiCall, type ApiCallDiagnostics } from './api-client';

export type { ApiCallDiagnostics };

/**
 * Punto de acceso desde componentes (via inject()) al diagnostico de la
 * ultima llamada a la API. El dato real lo llenan los interceptores de
 * Axios en api-client.ts; este servicio solo lo expone de forma idiomatica
 * para usarlo en templates de Angular.
 */
@Injectable({ providedIn: 'root' })
export class ApiDiagnosticsService {
  public lastCall = lastApiCall;
}
