import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Entrar</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <input formControlName="email" type="email" placeholder="email" autocomplete="email" />
        <input formControlName="password" type="password" placeholder="contraseña" autocomplete="current-password" />
        <button type="submit" [disabled]="form.invalid || loading()">Entrar</button>
      </form>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <p>¿No tenés cuenta? <a routerLink="/register">Registrate</a></p>
    </section>
  `,
  styleUrl: './auth-form.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/globe']),
      error: (e) => {
        this.error.set(e?.error?.error ?? 'No se pudo entrar');
        this.loading.set(false);
      },
    });
  }
}
