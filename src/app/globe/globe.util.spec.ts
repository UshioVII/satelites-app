import { dedupeSats } from './globe.util';

describe('dedupeSats', () => {
  it('quita satélites con el mismo satnum, conservando el primero', () => {
    const sats = [
      { name: 'ISS', satrec: { satnum: '25544' } },
      { name: 'HUBBLE', satrec: { satnum: '20580' } },
      { name: 'ISS DUP', satrec: { satnum: '25544' } },
    ] as any;
    const r = dedupeSats(sats);
    expect(r.length).toBe(2);
    expect(r.map((s: any) => s.name)).toEqual(['ISS', 'HUBBLE']);
  });

  it('lista vacía o sin duplicados pasa igual', () => {
    expect(dedupeSats([] as any)).toEqual([]);
    const two = [{ name: 'A', satrec: { satnum: 1 } }, { name: 'B', satrec: { satnum: 2 } }] as any;
    expect(dedupeSats(two).length).toBe(2);
  });
});
