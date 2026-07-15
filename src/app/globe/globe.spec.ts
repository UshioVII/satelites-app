import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Globe } from './globe';
import { AuthService } from '../auth/auth.service';

describe('Globe', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Globe);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('Globe viz persistence', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('con sesión, changeViz persiste viz_mode con PATCH /api/me', () => {
    const auth = TestBed.inject(AuthService);
    (auth as any)._user.set({ id: 1, email: 'a@b.com', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' });
    const fixture = TestBed.createComponent(Globe);
    const cmp = fixture.componentInstance;
    cmp.changeViz('heatmap');
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ viz_mode: 'heatmap' });
    req.flush({ id: 1, email: 'a@b.com', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'heatmap', avatar: 'preset:earth' });
    expect(cmp.vizMode()).toBe('heatmap');
  });

  it('sin sesión, changeViz no pega a /api/me', () => {
    const fixture = TestBed.createComponent(Globe);
    fixture.componentInstance.changeViz('heatmap');
    http.expectNone('/api/me');
    expect(fixture.componentInstance.vizMode()).toBe('heatmap');
  });

  afterEach(() => {
    // el constructor de Globe dispara loadSatellites() (GET a celestrak) sin
    // relación con estos tests; se drena antes de verify() para no acoplarnos a esa carga.
    http.match(() => true);
    http.verify();
  });
});
