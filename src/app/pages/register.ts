import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Crear cuenta</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <input formControlName="display_name" placeholder="nombre" autocomplete="nickname" />
        <input formControlName="email" type="email" placeholder="email" autocomplete="email" />
        <input formControlName="password" type="password" placeholder="contraseña (8+)" autocomplete="new-password" />
        <button type="submit" [disabled]="form.invalid || loading()">Registrarme</button>
      </form>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <p>¿Ya tenés cuenta? <a routerLink="/login">Entrar</a></p>
    </section>
  `,
  styleUrl: './auth-form.css',
})
export class Register {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    display_name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password, display_name } = this.form.getRawValue();
    this.auth.register(email, password, display_name).subscribe({
      next: () => this.router.navigate(['/globe']),
      error: (e) => {
        this.error.set(e?.error?.error ?? 'No se pudo registrar');
        this.loading.set(false);
      },
    });
  }
}
