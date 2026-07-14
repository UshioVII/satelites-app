import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { WikiService } from './wiki.service';

describe('WikiService', () => {
  let svc: WikiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WikiService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(WikiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('limpia el nombre (quita paréntesis) y pega a Wikipedia', () => {
    let got: any;
    svc.summary('ISS (ZARYA)').subscribe((r) => (got = r));
    const req = http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/ISS');
    req.flush({ title: 'ISS', extract: 'La ISS...', thumbnail: { source: 'http://img/x.jpg' }, content_urls: { desktop: { page: 'http://wiki/ISS' } } });
    expect(got.extract).toBe('La ISS...');
    expect(got.thumbnail).toBe('http://img/x.jpg');
  });

  it('devuelve null si no hay página (404)', () => {
    let got: any = 'x';
    svc.summary('Basura123').subscribe((r) => (got = r));
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Basura123').flush(null, { status: 404, statusText: 'Not Found' });
    expect(got).toBeNull();
  });

  it('cachea: la segunda llamada no pega de nuevo', () => {
    svc.summary('Hubble').subscribe();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble').flush({ title: 'Hubble', extract: 'x', thumbnail: null, content_urls: { desktop: { page: 'u' } } });
    svc.summary('Hubble').subscribe();
    http.expectNone('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble');
  });

  afterEach(() => http.verify());
});
