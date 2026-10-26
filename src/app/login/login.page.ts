import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { isAxiosError } from 'axios';
import { AuthService } from '../services/auth.service';
import { ApiConfigService } from '../services/api-config.service';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';
import { ApiErrorModalComponent } from '../components/api-error-modal/api-error-modal.component';

@Component({
  selector: 'app-login',
  standalone: true, // componente standalone: no depende de ningun NgModule
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  // Modulos/servicios de Angular que este componente usa directamente en su HTML
  imports: [CommonModule, FormsModule, IonContent, ApiErrorModalComponent],
})
export class LoginPage {
  // inject(): forma moderna de pedirle a Angular una instancia de un servicio,
  // en vez de recibirlo por el constructor.
  private auth = inject(AuthService); // servicio que llama a la API (login.php/register.php)
  private router = inject(Router); // para navegar a /tabs/tab1 tras iniciar sesion
  public config = inject(ApiConfigService); // a que servidor (IP) apuntan las APIs
  public diagnostics = inject(ApiDiagnosticsService); // detalle de la ultima llamada a la API

  // Estado de la animacion "flip" entre el formulario de Sign In y Sign Up
  toggled = false; // false = se ve Sign Up, true = se ve Sign In
  animating = false; // true mientras dura la animacion (1.5s)

  loading = false; // true mientras se espera la respuesta del servidor (deshabilita el boton)
  errorMessage = ''; // mensaje de error a mostrar si el login/registro falla

  // Campos del formulario de registro (Sign Up), atados con [(ngModel)] en el HTML
  signUpName = '';
  signUpEmail = '';
  signUpPassword = '';

  // Campos del formulario de inicio de sesion (Sign In)
  signInEmail = '';
  signInPassword = '';

  // Valor editable del campo "Servidor" (IP:puerto de la API). Arranca con
  // lo que ApiConfigService ya tenga activo (localhost en web, 10.0.2.2 en
  // el emulador de Android, o lo ultimo guardado en Preferences).
  serverAddressInput = '';
  serverSaved = false; // true un momento despues de guardar, para mostrar "Guardado"

  constructor() {
    // effect(): se ejecuta de inmediato con el valor actual del signal y
    // de nuevo cada vez que config.connectionConfig() cambie (por ejemplo,
    // cuando termine de cargar el JSON guardado en Preferences).
    effect(() => {
      this.config.connectionConfig(); // se lee para que el effect se vuelva a correr cuando cambie
      this.serverAddressInput = this.config.addressInput();
    });
  }

  /** Guarda la IP/host escrita en el campo "Servidor" (como JSON) y la activa de inmediato. */
  async saveServerAddress(): Promise<void> {
    await this.config.setServerAddress(this.serverAddressInput);
    this.serverSaved = true;
    setTimeout(() => {
      this.serverSaved = false;
    }, 1500);
  }

  /** Voltea la tarjeta entre el formulario de Sign In y el de Sign Up. */
  changeForm(): void {
    this.errorMessage = ''; // limpia errores del formulario anterior
    this.animating = true;
    setTimeout(() => {
      this.animating = false; // apaga la clase de animacion cuando termina
    }, 1500);

    this.toggled = !this.toggled; // cambia que formulario esta visible
  }

  /** Se ejecuta al enviar el formulario de "Sign In". */
  async onSignIn(event: Event): Promise<void> {
    event.preventDefault(); // evita que el <form> recargue la pagina
    this.errorMessage = '';
    this.loading = true;
    try {
      // Llama a la API de login (POST /login.php) a traves de AuthService.
      // El interceptor de api-client.ts llena diagnostics.lastCall() solo.
      const res = await this.auth.login(this.signInEmail, this.signInPassword);
      if (res.success) {
        // Login correcto: entra a la seccion de tabs
        this.router.navigateByUrl('/tabs/tab1');
      } else {
        // Credenciales invalidas u otro error de negocio (viene del backend)
        this.errorMessage = res.message;
      }
    } catch (err) {
      // El backend respondio pero con un codigo de error (401, 422, etc.):
      // se muestra el mensaje real de PHP en vez de uno generico.
      this.errorMessage = this.extractErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  /** Se ejecuta al enviar el formulario de "Sign Up" (crear cuenta). */
  async onSignUp(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage = '';
    this.loading = true;
    try {
      // Llama a la API de registro (POST /register.php) a traves de AuthService
      const res = await this.auth.register(this.signUpName, this.signUpEmail, this.signUpPassword);
      if (res.success) {
        // Cuenta creada: AuthService ya guardo la sesion, entra directo a la app
        this.router.navigateByUrl('/tabs/tab1');
      } else {
        // Ej: "Ese email ya esta registrado"
        this.errorMessage = res.message;
      }
    } catch (err) {
      this.errorMessage = this.extractErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Axios lanza una excepcion tambien cuando el servidor SI respondio pero
   * con un codigo de error (401, 409, 422...). En esos casos el body de la
   * respuesta trae { message } con el motivo real (ej. "Credenciales
   * invalidas."), que es mejor mostrar que un generico "no se pudo
   * conectar" -- ese generico se deja solo para cuando de plano no hubo
   * respuesta del servidor (red caida, IP equivocada, XAMPP apagado).
   */
  private extractErrorMessage(err: unknown): string {
    if (isAxiosError<{ message?: string }>(err) && err.response?.data?.message) {
      return err.response.data.message;
    }
    return 'No se pudo conectar con el servidor.';
  }
}
