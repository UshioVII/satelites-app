import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let svc: NotesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotesService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(NotesService);
    http = TestBed.inject(HttpTestingController);
  });

  it('get devuelve la nota', () => {
    let got: any;
    svc.get(25544).subscribe((r) => (got = r));
    http.expectOne('/api/notes/25544').flush({ norad_id: 25544, body: 'la vi', updated_at: 'now' });
    expect(got.body).toBe('la vi');
  });

  it('get devuelve null en 404', () => {
    let got: any = 'x';
    svc.get(25544).subscribe((r) => (got = r));
    http.expectOne('/api/notes/25544').flush(null, { status: 404, statusText: 'Not Found' });
    expect(got).toBeNull();
  });

  it('save hace PUT con body', () => {
    svc.save(25544, 'hola').subscribe();
    const req = http.expectOne('/api/notes/25544');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ body: 'hola' });
    req.flush({ norad_id: 25544, body: 'hola', updated_at: 'now' });
  });

  it('remove hace DELETE', () => {
    svc.remove(25544).subscribe();
    const req = http.expectOne('/api/notes/25544');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  afterEach(() => http.verify());
});
