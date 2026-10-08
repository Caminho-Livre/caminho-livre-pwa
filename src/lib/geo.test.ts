import { describe, expect, it } from 'vitest';
import {
  comprimentoM,
  curva,
  deslocar,
  distanciaAteRotaM,
  distanciaM,
  pontoNaRota,
  simplificar,
} from './geo';

const guara = { lat: -15.825, lng: -47.98 };

describe('geo', () => {
  it('mede um grau de latitude como ~111 km', () => {
    const d = distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('desloca em metros e mede de volta', () => {
    const p = deslocar(guara, 300, 400);
    expect(distanciaM(guara, p)).toBeCloseTo(500, 0);
  });

  it('mede a distância de um ponto ao meio de um segmento', () => {
    const a = guara;
    const b = deslocar(guara, 2000, 0);
    const p = deslocar(guara, 1000, 50);
    expect(distanciaAteRotaM(p, [a, b])).toBeCloseTo(50, 0);
  });

  it('usa a ponta do segmento quando o ponto fica além dela', () => {
    const a = guara;
    const b = deslocar(guara, 1000, 0);
    const p = deslocar(guara, 1300, 400);
    expect(distanciaAteRotaM(p, [a, b])).toBeCloseTo(500, 0);
  });

  it('acha o ponto no meio da rota', () => {
    const rota = [guara, deslocar(guara, 1000, 0), deslocar(guara, 1000, 1000)];
    const meio = pontoNaRota(rota, 0.5);
    expect(distanciaM(meio, rota[1])).toBeLessThan(1);
    expect(pontoNaRota(rota, 0)).toEqual(rota[0]);
    expect(pontoNaRota(rota, 1)).toEqual(rota[2]);
  });

  it('gera uma curva que começa e termina nos pontos pedidos e é mais longa que a reta', () => {
    const destino = deslocar(guara, 8000, 3000);
    const rota = curva(guara, destino, 0.2);
    expect(rota[0]).toEqual(guara);
    expect(rota[rota.length - 1]).toEqual(destino);
    expect(comprimentoM(rota)).toBeGreaterThan(distanciaM(guara, destino));
  });
});

describe('simplificar', () => {
  it('tira pontos em linha reta e mantém as curvas', () => {
    const reta = Array.from({ length: 101 }, (_, i) => deslocar(guara, i * 10, 0));
    expect(simplificar(reta, 5)).toHaveLength(2);
    const curva2 = [...reta, deslocar(guara, 1000, 500)];
    const simples = simplificar(curva2, 5);
    expect(simples).toHaveLength(3);
    expect(simples[1]).toEqual(reta[100]);
  });

  it('nunca se afasta mais que a tolerância do traçado original', () => {
    const rota = curva(guara, deslocar(guara, 9000, 4000), 0.3, 400);
    const simples = simplificar(rota, 5);
    expect(simples.length).toBeLessThan(rota.length / 4);
    for (const ponto of rota) expect(distanciaAteRotaM(ponto, simples)).toBeLessThanOrEqual(5.01);
  });
});
