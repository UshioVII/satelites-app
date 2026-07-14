import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Stats } from './stats';

describe('Stats', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Stats],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('carga TLEs y, sin ubicación, muestra el prompt', () => {
    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
    // el componente pide los TLEs al iniciar (via SatellitesService.loadTLEs -> /celestrak)
    const req = http.expectOne((r) => r.url.includes('/celestrak'));
    req.flush('ISS (ZARYA)\n1 25544U 98067A   24....\n2 25544  51.6....');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ubicación');
  });

  afterEach(() => http.verify());
});
