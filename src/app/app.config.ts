import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { AuthService } from './auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Bloquea la navegación inicial del router hasta que la sesión (si hay
    // token guardado) esté rehidratada, para que authGuard vea isLoggedIn()
    // correcto en un refresh de una ruta protegida.
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return auth.token() ? auth.rehydrate() : of(null);
    }),
  ],
};
