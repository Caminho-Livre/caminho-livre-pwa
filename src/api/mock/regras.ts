// Regras de negócio que no produto real moram no backend. Ficam aqui como
// funções puras para o mock usar e para os testes cobrirem; ao escrever a API
// Spring, este arquivo é a especificação do comportamento.

import { distanciaAteRotaM, distanciaM } from '../../lib/geo';
import { trajetoValendo } from '../../lib/tempo';
import type { LatLng, StatusAlerta, TipoAlerta, Trajeto } from '../tipos';

/** Parâmetros para calibrar. Comece permissivo e aperte conforme a base cresce. */
export const REGRAS = {
  /** Um alerta está "no caminho" se fica a até esta distância da rota. */
  distanciaTrajetoM: 80,
  /** Relatos do mesmo tipo dentro deste raio viram o mesmo alerta. */
  raioAgrupamentoM: 150,
  /** Quantas pessoas diferentes precisam relatar para o alerta aparecer. */
  relatosParaAparecer: 1,
  /** Quantos "não está mais" derrubam o alerta. Quem disse "não" já deixa de vê-lo. */
  negativasParaDerrubar: 2,
  /** Validade por tipo, em minutos. Um relato novo ou um "sim" renova. */
  ttlMin: { blitz: 40, radar: 60, bloqueio: 120, acidente: 60 } as Record<TipoAlerta, number>,
};

/** Como o mock guarda um alerta: com a lista de quem relatou e respondeu. */
export interface AlertaGuardado {
  id: string;
  tipo: TipoAlerta;
  posicao: LatLng;
  detalhes: string[];
  relatores: string[];
  confirmaram: string[];
  negaram: string[];
  status: StatusAlerta;
  criadoEm: string;
  atualizadoEm: string;
  expiraEm: string;
}

export interface EntradaRelato {
  usuarioId: string;
  tipo: TipoAlerta;
  posicao: LatLng;
  detalhes: string[];
}

export interface Cruzamento {
  alertaId: string;
  trajetoId: string;
  distanciaM: number;
}

const maisMinutos = (data: Date, minutos: number) => new Date(data.getTime() + minutos * 60_000);

const unir = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export function expirarVencidos(alertas: AlertaGuardado[], agora: Date): AlertaGuardado[] {
  return alertas.map((alerta) =>
    alerta.status === 'ativo' && new Date(alerta.expiraEm).getTime() <= agora.getTime()
      ? { ...alerta, status: 'expirado' as const }
      : alerta,
  );
}

export function visivel(alerta: AlertaGuardado): boolean {
  return alerta.status === 'ativo' && alerta.relatores.length >= REGRAS.relatosParaAparecer;
}

/** Quem disse "não está mais" para de ver o alerta, mesmo antes de ele cair. */
export function visivelPara(alerta: AlertaGuardado, usuarioId: string): boolean {
  return visivel(alerta) && !alerta.negaram.includes(usuarioId);
}

/**
 * Junta o relato a um alerta ativo do mesmo tipo que esteja perto, ou cria um
 * alerta novo. O mesmo usuário relatando duas vezes conta uma vez só.
 */
export function registrarRelato(
  alertas: AlertaGuardado[],
  entrada: EntradaRelato,
  agora: Date,
  novoId: string,
): { alertas: AlertaGuardado[]; alerta: AlertaGuardado; criouNovo: boolean } {
  const validade = maisMinutos(agora, REGRAS.ttlMin[entrada.tipo]).toISOString();

  let existente: AlertaGuardado | undefined;
  let menor = Infinity;
  for (const alerta of alertas) {
    if (alerta.status !== 'ativo' || alerta.tipo !== entrada.tipo) continue;
    const d = distanciaM(alerta.posicao, entrada.posicao);
    if (d <= REGRAS.raioAgrupamentoM && d < menor) {
      existente = alerta;
      menor = d;
    }
  }

  if (existente) {
    const atualizado: AlertaGuardado = {
      ...existente,
      relatores: unir(existente.relatores, [entrada.usuarioId]),
      detalhes: unir(existente.detalhes, entrada.detalhes),
      atualizadoEm: agora.toISOString(),
      expiraEm: validade,
    };
    return {
      alertas: alertas.map((a) => (a.id === atualizado.id ? atualizado : a)),
      alerta: atualizado,
      criouNovo: false,
    };
  }

  const novo: AlertaGuardado = {
    id: novoId,
    tipo: entrada.tipo,
    posicao: entrada.posicao,
    detalhes: [...new Set(entrada.detalhes)],
    relatores: [entrada.usuarioId],
    confirmaram: [],
    negaram: [],
    status: 'ativo',
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    expiraEm: validade,
  };
  return { alertas: [...alertas, novo], alerta: novo, criouNovo: true };
}

/** "Ainda está lá?": sim renova a validade, não conta para derrubar. */
export function registrarResposta(
  alertas: AlertaGuardado[],
  alertaId: string,
  usuarioId: string,
  aindaEsta: boolean,
  agora: Date,
): { alertas: AlertaGuardado[]; alerta: AlertaGuardado | null } {
  const atual = alertas.find((a) => a.id === alertaId);
  if (!atual) return { alertas, alerta: null };
  if (atual.status !== 'ativo') return { alertas, alerta: atual };

  const semEste = (lista: string[]) => lista.filter((id) => id !== usuarioId);
  let atualizado: AlertaGuardado;
  if (aindaEsta) {
    atualizado = {
      ...atual,
      confirmaram: unir(atual.confirmaram, [usuarioId]),
      negaram: semEste(atual.negaram),
      atualizadoEm: agora.toISOString(),
      expiraEm: maisMinutos(agora, REGRAS.ttlMin[atual.tipo]).toISOString(),
    };
  } else {
    const negaram = unir(atual.negaram, [usuarioId]);
    atualizado = {
      ...atual,
      confirmaram: semEste(atual.confirmaram),
      negaram,
      atualizadoEm: agora.toISOString(),
      status: negaram.length >= REGRAS.negativasParaDerrubar ? 'derrubado' : atual.status,
    };
  }
  return { alertas: alertas.map((a) => (a.id === alertaId ? atualizado : a)), alerta: atualizado };
}

export function trajetoValeAgora(trajeto: Trajeto, agora: Date): boolean {
  return trajetoValendo(trajeto, agora);
}

/**
 * Para cada alerta visível, o trajeto valendo agora que passa mais perto dele,
 * se passar a até REGRAS.distanciaTrajetoM. É o que decide quem recebe push.
 */
export function cruzar(
  trajetos: Trajeto[],
  alertas: AlertaGuardado[],
  agora: Date,
): Cruzamento[] {
  const valendo = trajetos.filter((t) => trajetoValeAgora(t, agora));
  const resultado: Cruzamento[] = [];
  for (const alerta of alertas) {
    if (!visivel(alerta)) continue;
    let melhor: Cruzamento | null = null;
    for (const trajeto of valendo) {
      const d = distanciaAteRotaM(alerta.posicao, trajeto.rota);
      if (d <= REGRAS.distanciaTrajetoM && (!melhor || d < melhor.distanciaM)) {
        melhor = { alertaId: alerta.id, trajetoId: trajeto.id, distanciaM: Math.round(d) };
      }
    }
    if (melhor) resultado.push(melhor);
  }
  return resultado;
}
