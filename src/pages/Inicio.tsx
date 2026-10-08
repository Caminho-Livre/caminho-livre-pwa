import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { BarraAbas, Erro } from '../components/Estrutura';
import { Icone, ICONE_DO_TIPO } from '../components/Icone';
import { Mapa, type PinoNoMapa } from '../components/Mapa';
import { useConsulta } from '../hooks/useConsulta';
import { regiaoDoUsuario } from '../lib/regiao';
import { agora } from '../lib/relogio';
import { NOME_TIPO } from '../lib/rotulos';
import { haQuanto, resumoDias, resumoJanela, trajetoValendo } from '../lib/tempo';

async function carregar() {
  // A região depende dos trajetos: busca eles primeiro.
  const trajetos = await api.listarTrajetos();
  const regiao = regiaoDoUsuario(trajetos, agora());
  const [alertas, noCaminho, atividade] = await Promise.all([
    api.listarAlertas(regiao),
    api.alertasNoCaminho(),
    api.atividadeRecente(regiao),
  ]);
  return { trajetos, regiao, alertas, noCaminho, atividade };
}

export default function Inicio() {
  const navegar = useNavigate();
  const { dados, erro } = useConsulta(carregar, [], { intervaloMs: 20_000 });

  const instante = agora();
  const trajetos = dados?.trajetos ?? [];
  const noCaminho = dados?.noCaminho ?? [];
  const emFoco =
    trajetos.find((t) => trajetoValendo(t, instante)) ?? null;
  const idsNoCaminho = new Set(noCaminho.map((item) => item.alerta.id));

  // Alertas da região mais os que caem no caminho (um trajeto longo pode
  // passar do raio da região).
  const visiveis = new Map((dados?.alertas ?? []).map((a) => [a.id, a]));
  for (const item of noCaminho) visiveis.set(item.alerta.id, item.alerta);
  const pinos: PinoNoMapa[] = [...visiveis.values()].map((alerta) => ({
    id: alerta.id,
    tipo: alerta.tipo,
    posicao: alerta.posicao,
    noCaminho: idsNoCaminho.has(alerta.id),
  }));

  const primeiro = noCaminho[0];
  const relatos = dados?.atividade.relatosUltimaHora ?? 0;

  return (
    <div className="tela">
      <div className="inicio__mapa">
        <Mapa
          rotulo="Mapa com seu trajeto e os alertas"
          rotas={emFoco ? [{ pontos: emFoco.rota }] : []}
          pinos={pinos}
          aoTocarPino={(id) => navegar(`/alerta/${id}`)}
          centro={dados?.regiao.centro ?? null}
          zoomPonto={11}
          folga={{ topo: 120 }}
        />

        {emFoco ? (
          <Link to="/trajetos" className="cartao cartao--flutuante">
            <div className="cartao__texto">
              <span className="sobretitulo">Trajeto ativo</span>
              <span className="cartao__titulo cartao__titulo--grande">{emFoco.nome}</span>
              <span className="mudo">
                {resumoDias(emFoco.diasSemana)} · {resumoJanela(emFoco.horaInicio, emFoco.horaFim)}
              </span>
            </div>
            <Icone nome="avancar" tamanho={22} />
          </Link>
        ) : dados ? (
          <Link to={trajetos.length ? '/trajetos' : '/trajetos/novo'} className="cartao cartao--flutuante">
            <div className="cartao__texto">
              <span className="sobretitulo sobretitulo--mudo">
                {trajetos.length ? 'Nenhum trajeto valendo agora' : 'Comece por aqui'}
              </span>
              <span className="cartao__titulo cartao__titulo--grande">
                {trajetos.length ? 'Ver meus trajetos' : 'Salvar meu primeiro trajeto'}
              </span>
              <span className="mudo">
                {trajetos.length
                  ? 'Fora do horário marcado você não recebe avisos.'
                  : 'Sem trajeto salvo, nenhum aviso chega até você.'}
              </span>
            </div>
            <Icone nome="avancar" tamanho={22} />
          </Link>
        ) : null}
      </div>

      <div className="inicio__painel">
        {erro ? <Erro>{erro.message}</Erro> : null}

        {primeiro ? (
          <Link to={`/alerta/${primeiro.alerta.id}`} className="cartao">
            <span className="selo-tipo">
              <Icone nome={ICONE_DO_TIPO[primeiro.alerta.tipo]} espessura={2.2} />
            </span>
            <div className="cartao__texto">
              <span className="sobretitulo">
                {noCaminho.length === 1
                  ? '1 alerta no seu caminho'
                  : `${noCaminho.length} alertas no seu caminho`}
              </span>
              <span className="cartao__titulo">{NOME_TIPO[primeiro.alerta.tipo]}</span>
              <span className="mudo">
                {primeiro.alerta.descricaoLocal} · {haQuanto(primeiro.alerta.criadoEm, instante)}
              </span>
            </div>
            <Icone nome="avancar" tamanho={22} />
          </Link>
        ) : emFoco ? (
          <div className="cartao cartao--calmo">
            <div className="cartao__texto">
              <span className="cartao__titulo">Nenhum alerta no seu caminho</span>
              <span className="mudo">Sem relato não quer dizer sem blitz.</span>
            </div>
          </div>
        ) : null}

        <p className="atividade">
          <span className="atividade__ponto" aria-hidden="true" />
          {relatos === 0
            ? 'Nenhum relato na região na última hora'
            : relatos === 1
              ? '1 relato na região na última hora'
              : `${relatos} relatos na região na última hora`}
        </p>

        <Link to="/reportar" className="botao">
          <Icone nome="mais" espessura={2.6} />
          Reportar
        </Link>
      </div>

      <BarraAbas />
    </div>
  );
}
