import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Profile } from './profile';
import { AuthService } from '../auth/auth.service';

const USER = { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' };

describe('Profile', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // simular sesión activa
    const auth = TestBed.inject(AuthService);
    (auth as any)._user.set(USER);
  });

  it('carga favoritos al iniciar y muestra el nombre', () => {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    http.expectOne('/api/favorites').flush([{ id: 1, norad_id: 25544, sat_name: 'ISS', archived: 0, created_at: 'now' }]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ISS');
  });

  afterEach(() => http.verify());
});
