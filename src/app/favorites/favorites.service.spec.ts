import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FavoritesService } from './favorites.service';

const FAV = { id: 1, norad_id: 25544, sat_name: 'ISS (ZARYA)', color: '#00e5ff', archived: 0, created_at: 'now' };

describe('FavoritesService', () => {
  let svc: FavoritesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FavoritesService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(FavoritesService);
    http = TestBed.inject(HttpTestingController);
  });

  it('list hace GET /api/favorites', () => {
    let got: any;
    svc.list().subscribe((r) => (got = r));
    const req = http.expectOne('/api/favorites');
    expect(req.request.method).toBe('GET');
    req.flush([FAV]);
    expect(got).toEqual([FAV]);
  });

  it('add hace POST con norad_id y sat_name (y recarga)', () => {
    svc.add(25544, 'ISS (ZARYA)').subscribe();
    const req = http.expectOne((r) => r.url === '/api/favorites' && r.method === 'POST');
    expect(req.request.body).toEqual({ norad_id: 25544, sat_name: 'ISS (ZARYA)' });
    req.flush(FAV);
    http.expectOne((r) => r.url === '/api/favorites' && r.method === 'GET').flush([FAV]); // reload
  });

  it('add con color lo manda en el body', () => {
    svc.add(25544, 'ISS', '#ff0000').subscribe();
    const req = http.expectOne((r) => r.url === '/api/favorites' && r.method === 'POST');
    expect(req.request.body).toEqual({ norad_id: 25544, sat_name: 'ISS', color: '#ff0000' });
    req.flush(FAV);
    http.expectOne((r) => r.url === '/api/favorites' && r.method === 'GET').flush([FAV]); // reload
  });

  it('setColor hace PATCH con color (y recarga)', () => {
    svc.setColor(1, '#00ff00').subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ color: '#00ff00' });
    req.flush({ ...FAV, color: '#00ff00' });
    http.expectOne('/api/favorites').flush([FAV]); // reload
  });

  it('setArchived hace PATCH (y recarga)', () => {
    svc.setArchived(1, true).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ archived: true });
    req.flush({ ...FAV, archived: 1 });
    http.expectOne('/api/favorites').flush([FAV]); // reload
  });

  it('remove hace DELETE (y recarga)', () => {
    svc.remove(1).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne('/api/favorites').flush([FAV]); // reload
  });

  afterEach(() => http.verify());
});
