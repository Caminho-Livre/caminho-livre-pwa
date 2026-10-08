import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PushAlerta } from '../tipos';
import { CODIGO_DE_TESTE, criarApiMock } from './mockApi';

async function logado() {
  const mock = criarApiMock({ latenciaMs: 0 });
  await mock.ferramentas.limparDados();
  await mock.api.solicitarCodigo('61 90000-0000');
  await mock.api.confirmarCodigo('61 90000-0000', CODIGO_DE_TESTE);
  return mock;
}

describe('mock da API', () => {
  // Domingo ao meio-dia: só o trajeto "todos os dias" vale, o de seg a sex não.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 4, 12, 0));
  });
  afterAll(() => vi.useRealTimers());

  it('recusa código errado e telefone curto', async () => {
    const { api } = criarApiMock({ latenciaMs: 0 });
    await expect(api.solicitarCodigo('123')).rejects.toMatchObject({ codigo: 'telefone-invalido' });
    await expect(api.confirmarCodigo('61900000000', '000000')).rejects.toMatchObject({
      codigo: 'codigo-invalido',
    });
  });

  it('dados de exemplo: um alerta no caminho, três no mapa', async () => {
    const { api, ferramentas } = await logado();
    await ferramentas.carregarExemplo();
    expect(await api.listarTrajetos()).toHaveLength(2);
    expect(await api.listarAlertas()).toHaveLength(3);
    const noCaminho = await api.alertasNoCaminho();
    expect(noCaminho).toHaveLength(1);
    expect(noCaminho[0].alerta.tipo).toBe('blitz');
    expect(noCaminho[0].trajetoNome).toBe('Casa → Trabalho');
    expect((await api.atividadeRecente()).relatosUltimaHora).toBe(5);
  });

  it('relato de outra pessoa em cima do trajeto gera push; fora dele, não', async () => {
    const { api, ferramentas } = await logado();
    await ferramentas.carregarExemplo();
    const recebidos: PushAlerta[] = [];
    const cancelar = api.aoReceberPush((p) => recebidos.push(p));

    const dentro = await ferramentas.simularRelatoNoTrajeto();
    expect(dentro?.notificou).toBe(true);
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].url).toBe(`/alerta/${dentro!.alerta.id}`);

    const fora = await ferramentas.simularRelatoFora();
    expect(fora.notificou).toBe(false);
    expect(recebidos).toHaveLength(1);

    cancelar();
    await ferramentas.simularRelatoNoTrajeto();
    expect(recebidos).toHaveLength(1);
  });

  it('meu relato vira alerta e "não está mais" o tira do mapa', async () => {
    const { api, ferramentas } = await logado();
    const posicao = ferramentas.posicaoSimulada();
    const { alerta } = await api.criarRelato({ tipo: 'bloqueio', posicao, detalhes: ['Meia pista'] });
    expect(alerta.relatos).toBe(1);
    expect(await api.listarAlertas()).toHaveLength(1);
    const depois = await api.responderAlerta(alerta.id, false);
    expect(depois.status).toBe('derrubado');
    expect(await api.listarAlertas()).toHaveLength(0);
  });

  it('cria, desliga e remove trajeto', async () => {
    const { api } = await logado();
    const [origem, destino] = await api.buscarLugares('a');
    const [rota] = await api.calcularRotas(origem, destino);
    const criado = await api.criarTrajeto({
      nome: '',
      origem,
      destino,
      rota: rota.rota,
      diasSemana: [1, 2, 3, 4, 5],
      horaInicio: '07:00',
      horaFim: '09:00',
    });
    expect(criado.nome).toBe(`${origem.nome} → ${destino.nome}`);
    expect((await api.atualizarTrajeto(criado.id, { ativo: false })).ativo).toBe(false);
    await api.removerTrajeto(criado.id);
    expect(await api.listarTrajetos()).toHaveLength(0);
  });
});
