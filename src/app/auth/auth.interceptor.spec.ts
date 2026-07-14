import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('agrega Bearer a /api cuando hay token', async () => {
    localStorage.setItem('sat_token', 'jwt123');
    http.get('/api/me').subscribe();
    const req = ctrl.expectOne('/api/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt123');
    req.flush({});

    // Este mismo http.get('/api/me') es lo primero que inyecta AuthService,
    // cuyo constructor ve el token en localStorage y agenda su propio
    // rehydrate() (GET /api/me) vía queueMicrotask para evitar NG0200
    // (ver auth.service.ts). Lo drenamos para no dejar un request colgado.
    await Promise.resolve();
    ctrl.expectOne('/api/me').flush({});
  });

  it('no agrega header sin token', () => {
    http.get('/api/me').subscribe();
    const req = ctrl.expectOne('/api/me');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  afterEach(() => ctrl.verify());
});
