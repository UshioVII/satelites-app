import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FavoritesService } from './favorites.service';

const FAV = { id: 1, norad_id: 25544, sat_name: 'ISS (ZARYA)', archived: 0, created_at: 'now' };

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

  it('add hace POST con norad_id y sat_name', () => {
    svc.add(25544, 'ISS (ZARYA)').subscribe();
    const req = http.expectOne('/api/favorites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ norad_id: 25544, sat_name: 'ISS (ZARYA)' });
    req.flush(FAV);
  });

  it('setArchived hace PATCH', () => {
    svc.setArchived(1, true).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ archived: true });
    req.flush({ ...FAV, archived: 1 });
  });

  it('remove hace DELETE', () => {
    svc.remove(1).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  afterEach(() => http.verify());
});
