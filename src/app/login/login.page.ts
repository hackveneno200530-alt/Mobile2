import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [CommonModule, FormsModule, IonContent],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  toggled = false;
  animating = false;
  loading = false;
  errorMessage = '';

  signUpName = '';
  signUpEmail = '';
  signUpPassword = '';

  signInEmail = '';
  signInPassword = '';

  changeForm(): void {
    this.errorMessage = '';
    this.animating = true;
    setTimeout(() => {
      this.animating = false;
    }, 1500);

    this.toggled = !this.toggled;
  }

  async onSignIn(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage = '';
    this.loading = true;
    try {
      const res = await this.auth.login(this.signInEmail, this.signInPassword);
      if (res.success) {
        this.router.navigateByUrl('/tabs/tab1');
      } else {
        this.errorMessage = res.message;
      }
    } catch (err) {
      this.errorMessage = 'No se pudo conectar con el servidor.';
    } finally {
      this.loading = false;
    }
  }

  async onSignUp(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage = '';
    this.loading = true;
    try {
      const res = await this.auth.register(this.signUpName, this.signUpEmail, this.signUpPassword);
      if (res.success) {
        this.router.navigateByUrl('/tabs/tab1');
      } else {
        this.errorMessage = res.message;
      }
    } catch (err) {
      this.errorMessage = 'No se pudo conectar con el servidor.';
    } finally {
      this.loading = false;
    }
  }
}
