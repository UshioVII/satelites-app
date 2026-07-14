import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Globe } from './globe';

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
