import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let router: { navigate: any };
  let loggedIn = false;

  beforeEach(() => {
    router = { navigate: (...a: any[]) => {} };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        { provide: Router, useValue: router },
      ],
    });
  });

  function run() {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
  }

  it('deja pasar con sesión', () => {
    loggedIn = true;
    expect(run()).toBe(true);
  });

  it('bloquea y redirige sin sesión', () => {
    loggedIn = false;
    let navegoA: any;
    router.navigate = (a: any[]) => (navegoA = a);
    expect(run()).toBe(false);
    expect(navegoA).toEqual(['/login']);
  });
});
