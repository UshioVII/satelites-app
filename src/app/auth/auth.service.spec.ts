import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

const USER = { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' };

describe('AuthService', () => {
  let svc: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('login guarda token y user', () => {
    let got: any;
    svc.login('a@b.com', 'secreto12').subscribe((u) => (got = u));
    const req = http.expectOne('/api/login');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt123', user: USER });
    expect(got).toEqual(USER);
    expect(svc.token()).toBe('jwt123');
    expect(svc.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('sat_token')).toBe('jwt123');
  });

  it('logout limpia sesión', () => {
    svc.login('a@b.com', 'secreto12').subscribe();
    http.expectOne('/api/login').flush({ token: 'jwt123', user: USER });
    svc.logout();
    expect(svc.token()).toBeNull();
    expect(svc.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('sat_token')).toBeNull();
  });

  it('register hace POST a /api/register', () => {
    svc.register('a@b.com', 'secreto12', 'Ana').subscribe();
    const req = http.expectOne('/api/register');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt123', user: USER });
    expect(svc.token()).toBe('jwt123');
  });

  afterEach(() => http.verify());

  describe('rehidratación al iniciar', () => {
    // rehydrate() ya no se auto-dispara desde el constructor: la llama
    // explícitamente el appInitializer (ver app.config.ts) antes de la
    // navegación inicial del router. Estos tests la invocan a mano, con un
    // token pre-existente en localStorage (simula un refresh con sesión
    // guardada) para que AuthService lo lea en su constructor.
    function freshServiceWithToken(): { s: AuthService; h: HttpTestingController } {
      localStorage.setItem('sat_token', 'jwt123');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
      });
      return { s: TestBed.inject(AuthService), h: TestBed.inject(HttpTestingController) };
    }

    afterEach(() => {
      TestBed.resetTestingModule();
      localStorage.clear();
    });

    it('rehidrata user si hay token al iniciar', () => {
      const { s, h } = freshServiceWithToken();
      s.rehydrate().subscribe();

      const req = h.expectOne('/api/me');
      expect(req.request.method).toBe('GET');
      req.flush(USER);

      expect(s.user()).toEqual(USER);
      expect(s.isLoggedIn()).toBe(true);
      h.verify();
    });

    it('logout si /api/me falla con 401 al iniciar', () => {
      const { s, h } = freshServiceWithToken();
      s.rehydrate().subscribe();

      const req = h.expectOne('/api/me');
      req.flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(s.token()).toBeNull();
      expect(s.isLoggedIn()).toBe(false);
      h.verify();
    });

    it('preserva el token si /api/me falla con un error transitorio (500)', () => {
      const { s, h } = freshServiceWithToken();
      s.rehydrate().subscribe();

      const req = h.expectOne('/api/me');
      req.flush('server error', { status: 500, statusText: 'Internal Server Error' });

      expect(s.token()).toBe('jwt123');
      expect(s.user()).toBeNull();
      expect(s.isLoggedIn()).toBe(false);
      h.verify();
    });
  });
});
