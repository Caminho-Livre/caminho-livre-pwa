import { createClient, type PostgrestError, type User } from '@supabase/supabase-js';
import { simplificar } from '../../lib/geo';
import { ErroApi, type Api } from '../contrato';
import type {
  Alerta,
  AlertaNoCaminho,
  Atividade,
  LatLng,
  Lugar,
  OpcaoRota,
  PushAlerta,
  Relato,
  Trajeto,
  Usuario,
} from '../tipos';

// Implementação do contrato com Supabase (Postgres + PostGIS + Auth).
// O backend (SQL e Edge Function) mora no projeto caminho-livre-api.
// As regras ficam nas funções SQL de supabase/migrations; aqui só há
// chamadas. Rotas e endereços vêm de serviços públicos e gratuitos do
// OpenStreetMap, bons para teste e com limite de uso:
//   - OSRM (router.project-osrm.org): servidor de demonstração.
//   - Nominatim (nominatim.openstreetmap.org): no máximo 1 busca por segundo
//     e nada de busca enquanto digita.

const URL_OSRM = 'https://router.project-osrm.org/route/v1/driving';
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org';
/** Caixa aproximada do DF: as buscas preferem resultados aqui, sem excluir o resto. */
const CAIXA_DF = '-48.29,-15.50,-47.30,-16.05';

export interface OpcoesSupabase {
  /** Troca o fetch nos testes. */
  buscar?: typeof fetch;
}

interface ResultadoNominatim {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

interface RespostaOsrm {
  code: string;
  routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
}

function paraUsuario(usuario: User): Usuario {
  return {
    id: usuario.id,
    telefone: usuario.phone || null,
    anonimo: usuario.is_anonymous ?? false,
    criadoEm: usuario.created_at,
  };
}

function paraErro(erro: PostgrestError): ErroApi {
  // 28000: sem login (exigir_usuario). P0001: mensagem de regra escrita no SQL.
  if (erro.code === '28000') return new ErroApi('nao-autenticado', 'Entre para continuar.');
  if (erro.code === 'P0001') return new ErroApi('regra', erro.message);
  console.error('Erro do Supabase', erro);
  return new ErroApi('servidor', 'Não consegui falar com o servidor. Tente de novo.');
}

/** "Rua X, Bairro" a partir do endereço do Nominatim. */
function nomeCurto(resultado: ResultadoNominatim): string {
  const a = resultado.address ?? {};
  const via = a.road ?? a.pedestrian ?? a.highway;
  const bairro = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter;
  const cidade = a.city ?? a.town ?? a.village;
  const partes = [resultado.name || via, bairro ?? cidade].filter(
    (parte, i, todas): parte is string => Boolean(parte) && todas.indexOf(parte) === i,
  );
  if (partes.length > 0) return partes.join(', ');
  return resultado.display_name.split(',').slice(0, 2).join(',').trim();
}

export function criarApiSupabase(url: string, chave: string, opcoes: OpcoesSupabase = {}): Api {
  const buscar = opcoes.buscar ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const cliente = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  async function rpc<T>(nome: string, argumentos?: Record<string, unknown>): Promise<T> {
    const { data, error } = await cliente.rpc(nome, argumentos);
    if (error) throw paraErro(error);
    return data as T;
  }

  // Nominatim pede no máximo uma requisição por segundo: enfileira.
  let fila: Promise<unknown> = Promise.resolve();
  let ultima = 0;
  function nominatim<T>(caminho: string, parametros: Record<string, string>): Promise<T> {
    const tarefa = fila.then(async () => {
      const espera = ultima + 1100 - Date.now();
      if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
      ultima = Date.now();
      const busca = new URLSearchParams({ format: 'jsonv2', 'accept-language': 'pt-BR', ...parametros });
      const resposta = await buscar(`${URL_NOMINATIM}/${caminho}?${busca}`);
      if (!resposta.ok) throw new Error(`Nominatim ${resposta.status}`);
      return (await resposta.json()) as T;
    });
    fila = tarefa.catch(() => undefined);
    return tarefa;
  }

  const cacheLocais = new Map<string, string>();

  async function nomeDoLocal(posicao: LatLng): Promise<string | null> {
    const chaveCache = `${posicao.lat.toFixed(4)},${posicao.lng.toFixed(4)}`;
    const salvo = cacheLocais.get(chaveCache);
    if (salvo) return salvo;
    try {
      const resultado = await nominatim<ResultadoNominatim & { error?: string }>('reverse', {
        lat: String(posicao.lat),
        lon: String(posicao.lng),
        zoom: '17',
        addressdetails: '1',
      });
      if (resultado.error) return null;
      const nome = nomeCurto(resultado);
      cacheLocais.set(chaveCache, nome);
      return nome;
    } catch {
      return null;
    }
  }

  /**
   * Avisa a Edge Function "notificar" (projeto caminho-livre-api), que manda
   * push para quem tem trajeto ali. Falhar aqui não desfaz o relato.
   */
  async function pedirNotificacao(alertaId: string): Promise<void> {
    const { error } = await cliente.functions.invoke('notificar', { body: { alertaId } });
    if (error) console.warn('Não consegui pedir o envio de push', error);
  }

  return {
    modoLogin: 'anonimo',

    async solicitarCodigo() {
      throw new ErroApi('nao-suportado', 'Login por SMS ainda não está ligado.');
    },

    async confirmarCodigo() {
      throw new ErroApi('nao-suportado', 'Login por SMS ainda não está ligado.');
    },

    async entrarAnonimo() {
      const { data, error } = await cliente.auth.signInAnonymously();
      if (error || !data.user) {
        console.error('Login anônimo', error);
        throw new ErroApi(
          'login',
          /disabled/i.test(error?.message ?? '')
            ? 'O login de teste está desligado no Supabase. Ligue "Allow anonymous sign-ins" em Authentication.'
            : 'Não consegui criar sua conta de teste. Tente de novo.',
        );
      }
      return paraUsuario(data.user);
    },

    async usuarioAtual() {
      const { data } = await cliente.auth.getSession();
      return data.session?.user ? paraUsuario(data.session.user) : null;
    },

    async sair() {
      await cliente.auth.signOut();
    },

    async buscarLugares(texto) {
      const termo = texto.trim();
      if (termo.length < 3) return [];
      try {
        const resultados = await nominatim<ResultadoNominatim[]>('search', {
          q: termo,
          limit: '6',
          addressdetails: '1',
          viewbox: CAIXA_DF,
        });
        return resultados.map((r) => ({
          id: String(r.place_id),
          nome: nomeCurto(r),
          posicao: { lat: Number(r.lat), lng: Number(r.lon) },
        }));
      } catch {
        throw new ErroApi('busca', 'A busca de endereços não respondeu. Tente de novo em instantes.');
      }
    },

    async descreverLocal(posicao) {
      const nome = await nomeDoLocal(posicao);
      return nome ? `Perto de ${nome}` : 'Local relatado';
    },

    async calcularRotas(origem: Lugar, destino: Lugar): Promise<OpcaoRota[]> {
      const pontos = `${origem.posicao.lng},${origem.posicao.lat};${destino.posicao.lng},${destino.posicao.lat}`;
      let corpo: RespostaOsrm;
      try {
        const resposta = await buscar(
          `${URL_OSRM}/${pontos}?alternatives=2&overview=full&geometries=geojson&steps=false`,
        );
        corpo = (await resposta.json()) as RespostaOsrm;
      } catch {
        throw new ErroApi('rota', 'O serviço de rotas não respondeu. Tente de novo em instantes.');
      }
      if (corpo.code !== 'Ok' || !corpo.routes?.length) {
        throw new ErroApi('rota', 'Não achei um caminho de carro entre esses dois pontos.');
      }
      return corpo.routes.slice(0, 3).map((rota, i) => ({
        id: `rota-${i}`,
        nome: i === 0 ? 'Mais rápida' : `Alternativa ${i}`,
        rota: simplificar(
          rota.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
          5,
        ),
        distanciaKm: Math.round(rota.distance / 100) / 10,
      }));
    },

    listarTrajetos: () => rpc<Trajeto[]>('listar_trajetos'),

    criarTrajeto: (dados) => rpc<Trajeto>('criar_trajeto', { dados }),

    atualizarTrajeto: (id, mudancas) =>
      rpc<Trajeto>('atualizar_trajeto', { p_id: id, p_ativo: mudancas.ativo }),

    async removerTrajeto(id) {
      await rpc<null>('remover_trajeto', { p_id: id });
    },

    listarAlertas: () => rpc<Alerta[]>('listar_alertas'),

    obterAlerta: (id) => rpc<Alerta | null>('obter_alerta', { p_id: id }),

    alertasNoCaminho: () => rpc<AlertaNoCaminho[]>('alertas_no_caminho'),

    async criarRelato(dados) {
      const resultado = await rpc<{ relato: Relato; alerta: Alerta }>('criar_relato', {
        p_tipo: dados.tipo,
        p_lat: dados.posicao.lat,
        p_lng: dados.posicao.lng,
        p_detalhes: dados.detalhes,
        p_descricao: dados.descricaoLocal ?? null,
      });
      void pedirNotificacao(resultado.alerta.id);
      return resultado;
    },

    responderAlerta: (id, aindaEsta) =>
      rpc<Alerta>('responder_alerta', { p_id: id, p_ainda_esta: aindaEsta }),

    atividadeRecente: () => rpc<Atividade>('atividade_recente'),

    async registrarAssinaturaPush(assinatura) {
      await rpc<null>('salvar_assinatura_push', {
        p_endpoint: assinatura.endpoint,
        p_p256dh: assinatura.p256dh,
        p_auth: assinatura.auth,
      });
    },

    aoReceberPush(ouvinte) {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
      // O service worker (public/sw-push.js) mostra a notificação e repassa
      // o conteúdo para as abas abertas.
      const aoMensagem = (evento: MessageEvent) => {
        const dados = evento.data as (Partial<PushAlerta> & { tipo?: string }) | null;
        if (dados?.tipo !== 'caminho-livre:push' || !dados.url) return;
        ouvinte({
          alertaId: dados.alertaId ?? '',
          titulo: dados.titulo ?? 'Caminho Livre',
          corpo: dados.corpo ?? '',
          url: dados.url,
          jaNotificado: true,
        });
      };
      navigator.serviceWorker.addEventListener('message', aoMensagem);
      return () => navigator.serviceWorker.removeEventListener('message', aoMensagem);
    },
  };
}
