import { afterEach, describe, expect, it } from 'vitest';
import { deslocar } from '../../lib/geo';
import type { Trajeto } from '../tipos';
import {
  REGRAS,
  cruzar,
  expirarVencidos,
  registrarRelato,
  registrarResposta,
  visivel,
  type AlertaGuardado,
} from './regras';

const guara = { lat: -15.825, lng: -47.98 };
// Segunda-feira, 8h.
const agora = new Date(2026, 9, 5, 8, 0);
const depois = (min: number) => new Date(agora.getTime() + min * 60_000);

const relato = (usuarioId: string, lesteM = 0, tipo: AlertaGuardado['tipo'] = 'blitz') => ({
  usuarioId,
  tipo,
  posicao: deslocar(guara, lesteM, 0),
  detalhes: [],
});

const trajeto = (mudancas: Partial<Trajeto> = {}): Trajeto => ({
  id: 't1',
  usuarioId: 'eu',
  nome: 'Casa → Trabalho',
  origem: { id: 'a', nome: 'A', posicao: deslocar(guara, -3000, 0) },
  destino: { id: 'b', nome: 'B', posicao: deslocar(guara, 3000, 0) },
  // Uma reta leste–oeste passando pelo Guará.
  rota: [deslocar(guara, -3000, 0), deslocar(guara, 3000, 0)],
  distanciaKm: 6,
  diasSemana: [1, 2, 3, 4, 5],
  horaInicio: '07:00',
  horaFim: '09:00',
  ativo: true,
  criadoEm: agora.toISOString(),
  ...mudancas,
});

const padrao = { ...REGRAS };
afterEach(() => Object.assign(REGRAS, padrao));

describe('registrarRelato', () => {
  it('cria um alerta no primeiro relato', () => {
    const r = registrarRelato([], relato('ana'), agora, 'a1');
    expect(r.criouNovo).toBe(true);
    expect(r.alertas).toHaveLength(1);
    expect(r.alerta.relatores).toEqual(['ana']);
    expect(new Date(r.alerta.expiraEm)).toEqual(depois(REGRAS.ttlMin.blitz));
  });

  it('junta relatos próximos do mesmo tipo e renova a validade', () => {
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const dois = registrarRelato(um.alertas, relato('bia', 100), depois(10), 'a2');
    expect(dois.criouNovo).toBe(false);
    expect(dois.alertas).toHaveLength(1);
    expect(dois.alerta.relatores).toEqual(['ana', 'bia']);
    expect(new Date(dois.alerta.expiraEm)).toEqual(depois(10 + REGRAS.ttlMin.blitz));
  });

  it('não conta duas vezes a mesma pessoa', () => {
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const dois = registrarRelato(um.alertas, relato('ana', 20), depois(1), 'a2');
    expect(dois.alerta.relatores).toEqual(['ana']);
  });

  it('separa relatos distantes ou de tipo diferente', () => {
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const longe = registrarRelato(um.alertas, relato('bia', 400), agora, 'a2');
    expect(longe.criouNovo).toBe(true);
    const outroTipo = registrarRelato(longe.alertas, relato('caio', 0, 'acidente'), agora, 'a3');
    expect(outroTipo.criouNovo).toBe(true);
    expect(outroTipo.alertas).toHaveLength(3);
  });

  it('não junta com alerta que já expirou', () => {
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const tarde = depois(REGRAS.ttlMin.blitz + 1);
    const vencidos = expirarVencidos(um.alertas, tarde);
    expect(vencidos[0].status).toBe('expirado');
    const dois = registrarRelato(vencidos, relato('bia'), tarde, 'a2');
    expect(dois.criouNovo).toBe(true);
  });
});

describe('registrarResposta', () => {
  it('"sim" renova a validade', () => {
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const r = registrarResposta(um.alertas, 'a1', 'bia', true, depois(30));
    expect(r.alerta?.confirmaram).toEqual(['bia']);
    expect(new Date(r.alerta!.expiraEm)).toEqual(depois(30 + REGRAS.ttlMin.blitz));
    expect(r.alerta?.status).toBe('ativo');
  });

  it('"não" derruba quando atinge o limite configurado', () => {
    REGRAS.negativasParaDerrubar = 2;
    const um = registrarRelato([], relato('ana'), agora, 'a1');
    const n1 = registrarResposta(um.alertas, 'a1', 'bia', false, depois(5));
    expect(n1.alerta?.status).toBe('ativo');
    const n2 = registrarResposta(n1.alertas, 'a1', 'caio', false, depois(6));
    expect(n2.alerta?.status).toBe('derrubado');
    expect(visivel(n2.alerta!)).toBe(false);
  });
});

describe('cruzar', () => {
  const alertaEm = (norteM: number) =>
    registrarRelato(
      [],
      { usuarioId: 'ana', tipo: 'blitz', posicao: deslocar(guara, 500, norteM), detalhes: [] },
      agora,
      'a1',
    ).alertas;

  it('acha o alerta a até 80 m da rota', () => {
    const r = cruzar([trajeto()], alertaEm(60), agora);
    expect(r).toHaveLength(1);
    expect(r[0].trajetoId).toBe('t1');
    expect(r[0].distanciaM).toBe(60);
  });

  it('ignora alerta fora da distância', () => {
    expect(cruzar([trajeto()], alertaEm(120), agora)).toHaveLength(0);
  });

  it('ignora trajeto desligado ou fora da janela', () => {
    expect(cruzar([trajeto({ ativo: false })], alertaEm(10), agora)).toHaveLength(0);
    expect(cruzar([trajeto()], alertaEm(10), new Date(2026, 9, 5, 12, 0))).toHaveLength(0);
    // Sábado, 8h.
    expect(cruzar([trajeto()], alertaEm(10), new Date(2026, 9, 10, 8, 0))).toHaveLength(0);
  });

  it('respeita o mínimo de relatos para o alerta aparecer', () => {
    REGRAS.relatosParaAparecer = 2;
    const um = alertaEm(10);
    expect(cruzar([trajeto()], um, agora)).toHaveLength(0);
    const dois = registrarRelato(
      um,
      { usuarioId: 'bia', tipo: 'blitz', posicao: deslocar(guara, 520, 10), detalhes: [] },
      agora,
      'a2',
    ).alertas;
    expect(cruzar([trajeto()], dois, agora)).toHaveLength(1);
  });
});
