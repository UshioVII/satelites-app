import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('en éxito navega a /globe', () => {
    const fixture = TestBed.createComponent(Login);
    const cmp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    let nav: any;
    (router as any).navigate = (a: any[]) => (nav = a);
    cmp.form.setValue({ email: 'a@b.com', password: 'secreto12' });
    cmp.submit();
    http.expectOne('/api/login').flush({ token: 't', user: { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' } });
    expect(nav).toEqual(['/globe']);
  });

  it('en error muestra el mensaje del backend', () => {
    const fixture = TestBed.createComponent(Login);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ email: 'a@b.com', password: 'mala1234' });
    cmp.submit();
    http.expectOne('/api/login').flush({ error: 'credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });
    expect(cmp.error()).toBe('credenciales inválidas');
  });

  afterEach(() => http.verify());
});
