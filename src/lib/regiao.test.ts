import { describe, expect, it } from 'vitest';
import type { Trajeto } from '../api/tipos';
import { CENTRO_PADRAO, deslocar, distanciaM } from './geo';
import { regiaoDoUsuario } from './regiao';

const malaga = { lat: 36.72, lng: -4.42 };

function trajeto(mudancas: Partial<Trajeto>): Trajeto {
  return {
    id: 't',
    usuarioId: 'u',
    nome: 'teste',
    origem: { id: 'a', nome: 'a', posicao: malaga },
    destino: { id: 'b', nome: 'b', posicao: deslocar(malaga, 10_000, 0) },
    rota: [malaga, deslocar(malaga, 10_000, 0)],
    distanciaKm: 10,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    horaInicio: '00:00',
    horaFim: '23:59',
    ativo: true,
    criadoEm: '',
    ...mudancas,
  };
}

describe('regiaoDoUsuario', () => {
  it('sem trajeto, usa o DF', () => {
    expect(regiaoDoUsuario([], new Date())).toEqual({ centro: CENTRO_PADRAO, raioKm: 50 });
  });

  it('com trajeto, centra no meio da rota', () => {
    const r = regiaoDoUsuario([trajeto({})], new Date());
    expect(distanciaM(r.centro, deslocar(malaga, 5000, 0))).toBeLessThan(5);
    expect(r.raioKm).toBe(50);
  });

  it('trajeto longo aumenta o raio para caber inteiro', () => {
    const longo = trajeto({ rota: [malaga, deslocar(malaga, 160_000, 0)] });
    expect(regiaoDoUsuario([longo], new Date()).raioKm).toBe(90);
  });
});
