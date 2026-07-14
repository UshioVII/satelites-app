import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SatInfo } from './sat-info';

describe('SatInfo', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SatInfo],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('muestra el resumen de Wikipedia', () => {
    const fixture = TestBed.createComponent(SatInfo);
    fixture.componentRef.setInput('name', 'Hubble');
    fixture.componentRef.setInput('noradId', 20580);
    fixture.detectChanges();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble')
      .flush({ title: 'Hubble', extract: 'Telescopio espacial', thumbnail: null, content_urls: { desktop: { page: 'u' } } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Telescopio espacial');
    // sin sesión: no hay editor de notas ni pega a /api/notes
    http.expectNone('/api/notes/20580');
  });

  it('muestra fallback cuando no hay página de Wikipedia', () => {
    const fixture = TestBed.createComponent(SatInfo);
    fixture.componentRef.setInput('name', 'Basura');
    fixture.componentRef.setInput('noradId', 1);
    fixture.detectChanges();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Basura').flush(null, { status: 404, statusText: 'NF' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin datos de Wikipedia');
  });

  afterEach(() => http.verify());
});
