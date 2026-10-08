import { comprimentoKm, curva, deslocar, distanciaM, pontoNaRota } from '../../lib/geo';
import { invalidar } from '../../lib/eventos';
import { agora } from '../../lib/relogio';
import { NOME_TIPO, TIPOS } from '../../lib/rotulos';
import { ErroApi, type Api } from '../contrato';
import type {
  Alerta,
  AlertaNoCaminho,
  LatLng,
  Lugar,
  PushAlerta,
  Relato,
  TipoAlerta,
  Trajeto,
  Usuario,
} from '../tipos';
import { apagar, gravar, ler } from './armazenamento';
import { LUGARES, lugar } from './lugares';
import {
  cruzar,
  expirarVencidos,
  registrarRelato,
  registrarResposta,
  trajetoValeAgora,
  visivel,
  type AlertaGuardado,
} from './regras';

const CHAVE = 'caminho-livre:mock:v1';

/** Código que o mock aceita no login. */
export const CODIGO_DE_TESTE = '123456';

interface Banco {
  usuario: Usuario | null;
  trajetos: Trajeto[];
  alertas: AlertaGuardado[];
  relatos: Relato[];
}

const BANCO_VAZIO: Banco = { usuario: null, trajetos: [], alertas: [], relatos: [] };

export interface ResultadoSimulacao {
  alerta: Alerta;
  /** O relato caiu num trajeto que vale agora e gerou push. */
  notificou: boolean;
  motivo?: string;
}

export interface FerramentasDeTeste {
  /** Dois trajetos e três alertas no DF, um deles no caminho. */
  carregarExemplo(): Promise<void>;
  /** Outro usuário relata algo em cima de um trajeto seu. Deve gerar push. */
  simularRelatoNoTrajeto(): Promise<ResultadoSimulacao | null>;
  /** Outro usuário relata algo longe dos seus trajetos. Não deve gerar push. */
  simularRelatoFora(): Promise<ResultadoSimulacao>;
  /** Posição usada no lugar do GPS quando a posição simulada está ligada. */
  posicaoSimulada(): LatLng;
  /** Apaga trajetos, alertas e relatos. Mantém o login. */
  limparDados(): Promise<void>;
}

let contador = 0;
function novoId(prefixo: string): string {
  // crypto.randomUUID só existe em contexto seguro (https/localhost); isto
  // funciona também ao abrir pelo IP da rede local no celular.
  contador += 1;
  return `${prefixo}-${Date.now().toString(36)}-${contador.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function descrever(posicao: LatLng): string {
  let perto: Lugar = LUGARES[0];
  let menor = Infinity;
  for (const candidato of LUGARES) {
    const d = distanciaM(posicao, candidato.posicao);
    if (d < menor) {
      menor = d;
      perto = candidato;
    }
  }
  return `Perto de ${perto.nome}`;
}

function paraAlerta(guardado: AlertaGuardado): Alerta {
  return {
    id: guardado.id,
    tipo: guardado.tipo,
    posicao: guardado.posicao,
    descricaoLocal: descrever(guardado.posicao),
    detalhes: guardado.detalhes,
    relatos: guardado.relatores.length,
    confirmacoes: guardado.confirmaram.length,
    negativas: guardado.negaram.length,
    status: guardado.status,
    criadoEm: guardado.criadoEm,
    atualizadoEm: guardado.atualizadoEm,
    expiraEm: guardado.expiraEm,
  };
}

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function criarApiMock(opcoes: { latenciaMs?: number } = {}): {
  api: Api;
  ferramentas: FerramentasDeTeste;
} {
  const latenciaMs = opcoes.latenciaMs ?? 250;
  const ouvintesPush = new Set<(push: PushAlerta) => void>();

  let banco: Banco = { ...BANCO_VAZIO, ...ler<Partial<Banco>>(CHAVE, {}) };

  const salvar = () => gravar(CHAVE, banco);
  const esperar = () =>
    latenciaMs > 0 ? new Promise<void>((ok) => setTimeout(ok, latenciaMs)) : Promise.resolve();

  /** Marca como expirados os alertas vencidos antes de qualquer leitura. */
  const atualizarValidade = () => {
    const antes = banco.alertas;
    banco.alertas = expirarVencidos(antes, agora());
    if (banco.alertas.some((a, i) => a !== antes[i])) salvar();
  };

  const exigirUsuario = (): Usuario => {
    if (!banco.usuario) throw new ErroApi('nao-autenticado', 'Entre com seu celular para continuar.');
    return banco.usuario;
  };

  const meusTrajetos = (usuario: Usuario) => banco.trajetos.filter((t) => t.usuarioId === usuario.id);

  const guardarRelato = (
    usuarioId: string,
    tipo: TipoAlerta,
    posicao: LatLng,
    detalhes: string[],
  ): { relato: Relato; guardado: AlertaGuardado } => {
    atualizarValidade();
    const resultado = registrarRelato(
      banco.alertas,
      { usuarioId, tipo, posicao, detalhes },
      agora(),
      novoId('alerta'),
    );
    const relato: Relato = {
      id: novoId('relato'),
      usuarioId,
      alertaId: resultado.alerta.id,
      tipo,
      posicao,
      detalhes,
      criadoEm: agora().toISOString(),
    };
    banco.alertas = resultado.alertas;
    banco.relatos = [...banco.relatos, relato];
    salvar();
    return { relato, guardado: resultado.alerta };
  };

  /** O que o backend faria depois de gravar um relato de outra pessoa. */
  const cruzarEAvisar = (guardado: AlertaGuardado): { notificou: boolean; motivo?: string } => {
    const usuario = banco.usuario;
    if (!usuario) return { notificou: false, motivo: 'Ninguém está logado.' };
    if (!visivel(guardado)) {
      return { notificou: false, motivo: 'O alerta ainda não atingiu o mínimo de relatos.' };
    }
    const trajetos = meusTrajetos(usuario);
    const [cruzamento] = cruzar(trajetos, [guardado], agora());
    if (!cruzamento) {
      return {
        notificou: false,
        motivo: 'Não cai em nenhum trajeto ligado e dentro do horário.',
      };
    }
    const trajeto = trajetos.find((t) => t.id === cruzamento.trajetoId);
    const push: PushAlerta = {
      alertaId: guardado.id,
      titulo: `${NOME_TIPO[guardado.tipo]} no seu caminho`,
      corpo: `${descrever(guardado.posicao)} · ${trajeto?.nome ?? 'seu trajeto'}`,
      url: `/alerta/${guardado.id}`,
    };
    for (const ouvinte of [...ouvintesPush]) ouvinte(push);
    return { notificou: true };
  };

  const api: Api = {
    modoLogin: 'codigo',

    async entrarAnonimo() {
      throw new ErroApi('nao-suportado', 'O modo de teste local entra por código.');
    },

    async registrarAssinaturaPush() {
      // Sem servidor no mock: o push é simulado pelas ferramentas de teste.
    },

    async solicitarCodigo(telefone) {
      await esperar();
      const digitos = telefone.replace(/\D/g, '');
      if (digitos.length < 10 || digitos.length > 11) {
        throw new ErroApi('telefone-invalido', 'Informe o DDD e o número, por exemplo 61 90000-0000.');
      }
      // O mock não envia SMS: o código é sempre CODIGO_DE_TESTE.
    },

    async confirmarCodigo(telefone, codigo) {
      await esperar();
      if (codigo.trim() !== CODIGO_DE_TESTE) {
        throw new ErroApi('codigo-invalido', 'Código incorreto. Confira o SMS e tente de novo.');
      }
      const digitos = telefone.replace(/\D/g, '');
      // Mesmo telefone, mesmo usuário: os trajetos salvos continuam valendo.
      const usuario: Usuario =
        banco.usuario && banco.usuario.telefone === digitos
          ? banco.usuario
          : {
              id: `usuario-${digitos}`,
              telefone: digitos,
              anonimo: false,
              criadoEm: agora().toISOString(),
            };
      banco.usuario = usuario;
      salvar();
      return usuario;
    },

    async usuarioAtual() {
      return banco.usuario;
    },

    async sair() {
      await esperar();
      banco.usuario = null;
      salvar();
    },

    async buscarLugares(texto) {
      await esperar();
      const termo = semAcento(texto.trim());
      if (!termo) return LUGARES;
      return LUGARES.filter((l) => semAcento(l.nome).includes(termo));
    },

    async descreverLocal(posicao) {
      await esperar();
      return descrever(posicao);
    },

    async calcularRotas(origem, destino) {
      await esperar();
      if (origem.id === destino.id) {
        throw new ErroApi('rota-invalida', 'Origem e destino precisam ser lugares diferentes.');
      }
      // Sem roteador no mock: duas curvas entre os pontos fazem o papel das
      // alternativas que o OSRM devolveria.
      const direta = curva(origem.posicao, destino.posicao, 0.05);
      const alternativa = curva(origem.posicao, destino.posicao, -0.22);
      return [
        { id: 'direta', nome: 'Mais direta', rota: direta, distanciaKm: comprimentoKm(direta) },
        {
          id: 'alternativa',
          nome: 'Alternativa',
          rota: alternativa,
          distanciaKm: comprimentoKm(alternativa),
        },
      ];
    },

    async listarTrajetos() {
      await esperar();
      return meusTrajetos(exigirUsuario());
    },

    async criarTrajeto(dados) {
      await esperar();
      const usuario = exigirUsuario();
      if (dados.diasSemana.length === 0) {
        throw new ErroApi('trajeto-invalido', 'Escolha pelo menos um dia da semana.');
      }
      const trajeto: Trajeto = {
        id: novoId('trajeto'),
        usuarioId: usuario.id,
        nome: dados.nome.trim() || `${dados.origem.nome} → ${dados.destino.nome}`,
        origem: dados.origem,
        destino: dados.destino,
        rota: dados.rota,
        distanciaKm: comprimentoKm(dados.rota),
        diasSemana: [...new Set(dados.diasSemana)].sort(),
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        fuso: dados.fuso,
        ativo: true,
        criadoEm: agora().toISOString(),
      };
      banco.trajetos = [...banco.trajetos, trajeto];
      salvar();
      return trajeto;
    },

    async atualizarTrajeto(id, mudancas) {
      await esperar();
      const usuario = exigirUsuario();
      const atual = meusTrajetos(usuario).find((t) => t.id === id);
      if (!atual) throw new ErroApi('nao-encontrado', 'Trajeto não encontrado.');
      const atualizado = { ...atual, ativo: mudancas.ativo };
      banco.trajetos = banco.trajetos.map((t) => (t.id === id ? atualizado : t));
      salvar();
      return atualizado;
    },

    async removerTrajeto(id) {
      await esperar();
      const usuario = exigirUsuario();
      banco.trajetos = banco.trajetos.filter((t) => !(t.id === id && t.usuarioId === usuario.id));
      salvar();
    },

    async listarAlertas(regiao) {
      await esperar();
      atualizarValidade();
      const limite = regiao.raioKm * 1000;
      return banco.alertas
        .filter((a) => visivel(a) && distanciaM(a.posicao, regiao.centro) <= limite)
        .map(paraAlerta);
    },

    async obterAlerta(id) {
      await esperar();
      atualizarValidade();
      const guardado = banco.alertas.find((a) => a.id === id);
      return guardado ? paraAlerta(guardado) : null;
    },

    async alertasNoCaminho() {
      await esperar();
      const usuario = exigirUsuario();
      atualizarValidade();
      const trajetos = meusTrajetos(usuario);
      const resultado: AlertaNoCaminho[] = [];
      for (const cruzamento of cruzar(trajetos, banco.alertas, agora())) {
        const guardado = banco.alertas.find((a) => a.id === cruzamento.alertaId);
        const trajeto = trajetos.find((t) => t.id === cruzamento.trajetoId);
        if (!guardado || !trajeto) continue;
        resultado.push({
          alerta: paraAlerta(guardado),
          trajetoId: trajeto.id,
          trajetoNome: trajeto.nome,
          distanciaM: cruzamento.distanciaM,
        });
      }
      // Mais recente primeiro.
      return resultado.sort((a, b) => b.alerta.atualizadoEm.localeCompare(a.alerta.atualizadoEm));
    },

    async criarRelato(dados) {
      await esperar();
      const usuario = exigirUsuario();
      const { relato, guardado } = guardarRelato(usuario.id, dados.tipo, dados.posicao, dados.detalhes);
      return { relato, alerta: paraAlerta(guardado) };
    },

    async responderAlerta(id, aindaEsta) {
      await esperar();
      const usuario = exigirUsuario();
      atualizarValidade();
      const resultado = registrarResposta(banco.alertas, id, usuario.id, aindaEsta, agora());
      if (!resultado.alerta) throw new ErroApi('nao-encontrado', 'Alerta não encontrado.');
      banco.alertas = resultado.alertas;
      salvar();
      return paraAlerta(resultado.alerta);
    },

    async atividadeRecente(regiao) {
      await esperar();
      const desde = agora().getTime() - 60 * 60_000;
      const raio = regiao.raioKm * 1000;
      return {
        relatosUltimaHora: banco.relatos.filter(
          (r) => new Date(r.criadoEm).getTime() >= desde && distanciaM(r.posicao, regiao.centro) <= raio,
        ).length,
      };
    },

    aoReceberPush(ouvinte) {
      ouvintesPush.add(ouvinte);
      return () => {
        ouvintesPush.delete(ouvinte);
      };
    },
  };

  let vizinhos = 0;
  const outroUsuario = () => {
    vizinhos += 1;
    return `vizinho-${Date.now().toString(36)}-${vizinhos}`;
  };

  const trajetoParaSimular = (): Trajeto | null => {
    if (!banco.usuario) return null;
    const meus = meusTrajetos(banco.usuario);
    return (
      meus.find((t) => trajetoValeAgora(t, agora())) ?? meus.find((t) => t.ativo) ?? meus[0] ?? null
    );
  };

  const ferramentas: FerramentasDeTeste = {
    async carregarExemplo() {
      const usuario = exigirUsuario();
      const casa = lugar('aguas-claras');
      const trabalho = lugar('scs');
      const ida = curva(casa.posicao, trabalho.posicao, 0.05);
      const volta = [...ida].reverse();
      const instante = agora();
      const ha = (minutos: number) => new Date(instante.getTime() - minutos * 60_000).toISOString();
      const em = (minutos: number) => new Date(instante.getTime() + minutos * 60_000).toISOString();

      const trajetos: Trajeto[] = [
        {
          id: novoId('trajeto'),
          usuarioId: usuario.id,
          nome: 'Casa → Trabalho',
          origem: casa,
          destino: trabalho,
          rota: ida,
          distanciaKm: comprimentoKm(ida),
          // O dia todo, todos os dias, para sempre haver um trajeto valendo no teste.
          diasSemana: [0, 1, 2, 3, 4, 5, 6],
          horaInicio: '00:00',
          horaFim: '23:59',
          ativo: true,
          criadoEm: ha(60 * 24),
        },
        {
          id: novoId('trajeto'),
          usuarioId: usuario.id,
          nome: 'Trabalho → Casa',
          origem: trabalho,
          destino: casa,
          rota: volta,
          distanciaKm: comprimentoKm(volta),
          diasSemana: [1, 2, 3, 4, 5],
          horaInicio: '17:30',
          horaFim: '19:30',
          ativo: true,
          criadoEm: ha(60 * 24),
        },
      ];

      const semente = (
        tipo: TipoAlerta,
        posicao: LatLng,
        detalhes: string[],
        relatores: number,
        minutosAtras: number,
        expiraEmMin: number,
      ): AlertaGuardado => ({
        id: novoId('alerta'),
        tipo,
        posicao,
        detalhes,
        relatores: Array.from({ length: relatores }, () => outroUsuario()),
        confirmaram: [],
        negaram: [],
        status: 'ativo',
        criadoEm: ha(minutosAtras),
        atualizadoEm: ha(Math.max(1, minutosAtras - 4)),
        expiraEm: em(expiraEmMin),
      });

      const alertas: AlertaGuardado[] = [
        // Em cima do trajeto de ida: é o que aparece como "no seu caminho".
        semente('blitz', deslocar(pontoNaRota(ida, 0.55), 10, 12), ['Só moto'], 3, 6, 34),
        // Longe dos trajetos: aparece no mapa, mas não avisa.
        semente('radar', lugar('taguatinga').posicao, ['Em viatura'], 1, 18, 42),
        semente('bloqueio', lugar('asa-norte').posicao, ['Meia pista'], 1, 35, 85),
      ];

      const relatos: Relato[] = alertas.flatMap((alerta) =>
        alerta.relatores.map((usuarioId) => ({
          id: novoId('relato'),
          usuarioId,
          alertaId: alerta.id,
          tipo: alerta.tipo,
          posicao: alerta.posicao,
          detalhes: alerta.detalhes,
          criadoEm: alerta.criadoEm,
        })),
      );

      banco.trajetos = [...banco.trajetos.filter((t) => t.usuarioId !== usuario.id), ...trajetos];
      banco.alertas = alertas;
      banco.relatos = relatos;
      salvar();
      invalidar();
    },

    async simularRelatoNoTrajeto() {
      const trajeto = trajetoParaSimular();
      if (!trajeto) return null;
      const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
      const naRota = pontoNaRota(trajeto.rota, 0.2 + Math.random() * 0.6);
      // Alguns metros fora do eixo, como um relato de verdade.
      const posicao = deslocar(naRota, Math.random() * 30 - 15, Math.random() * 30 - 15);
      const { guardado } = guardarRelato(outroUsuario(), tipo, posicao, []);
      const aviso = cruzarEAvisar(guardado);
      invalidar();
      return { alerta: paraAlerta(guardado), ...aviso };
    },

    async simularRelatoFora() {
      const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
      const base = lugar(['sobradinho', 'planaltina', 'gama'][Math.floor(Math.random() * 3)]);
      const posicao = deslocar(base.posicao, Math.random() * 800 - 400, Math.random() * 800 - 400);
      const { guardado } = guardarRelato(outroUsuario(), tipo, posicao, []);
      const aviso = cruzarEAvisar(guardado);
      invalidar();
      return { alerta: paraAlerta(guardado), ...aviso };
    },

    posicaoSimulada() {
      const trajeto = trajetoParaSimular();
      return trajeto ? pontoNaRota(trajeto.rota, 0.45) : lugar('guara').posicao;
    },

    async limparDados() {
      const usuario = banco.usuario;
      apagar(CHAVE);
      banco = { ...BANCO_VAZIO, usuario };
      salvar();
      invalidar();
    },
  };

  return { api, ferramentas };
}
