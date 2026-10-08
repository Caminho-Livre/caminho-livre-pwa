import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Trajeto } from '../api/tipos';
import { BarraAbas, Carregando, Erro } from '../components/Estrutura';
import { Icone } from '../components/Icone';
import { useConsulta } from '../hooks/useConsulta';
import { invalidar } from '../lib/eventos';
import { agora } from '../lib/relogio';
import { resumoDias, resumoJanela, trajetoValendo } from '../lib/tempo';

async function carregar() {
  const [trajetos, noCaminho] = await Promise.all([api.listarTrajetos(), api.alertasNoCaminho()]);
  return { trajetos, noCaminho };
}

export default function Trajetos() {
  const { dados, erro, carregando } = useConsulta(carregar, [], { intervaloMs: 30_000 });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const instante = agora();

  async function executar(acao: () => Promise<unknown>) {
    setErroAcao(null);
    try {
      await acao();
      invalidar();
    } catch (falha) {
      setErroAcao(falha instanceof Error ? falha.message : 'Não consegui salvar.');
    }
  }

  function situacao(trajeto: Trajeto): { texto: string; destaque: boolean } {
    if (!trajeto.ativo) return { texto: 'Avisos desligados', destaque: false };
    if (!trajetoValendo(trajeto, instante)) {
      return { texto: 'Fora do horário agora', destaque: false };
    }
    const alertas = dados?.noCaminho.filter((item) => item.trajetoId === trajeto.id).length ?? 0;
    const sufixo = alertas === 0 ? 'sem alertas' : alertas === 1 ? '1 alerta' : `${alertas} alertas`;
    return { texto: `Valendo agora · ${sufixo}`, destaque: true };
  }

  return (
    <div className="tela">
      <main className="tela__rolagem tela__rolagem--topo">
        <div>
          <h1 className="titulo-medio">Trajetos</h1>
          <p className="subtitulo subtitulo--mudo">
            Você só recebe aviso do que cair nestes caminhos, nos dias e horários marcados.
          </p>
        </div>

        {carregando ? <Carregando /> : null}
        {erro ? <Erro>{erro.message}</Erro> : null}
        {erroAcao ? <Erro>{erroAcao}</Erro> : null}

        {dados && dados.trajetos.length === 0 ? (
          <p className="vazio">Nenhum trajeto salvo ainda. Sem trajeto, nenhum aviso chega até você.</p>
        ) : null}

        <ul className="lista">
          {dados?.trajetos.map((trajeto) => {
            const estado = situacao(trajeto);
            return (
              <li key={trajeto.id} className="cartao cartao--trajeto">
                <div className="cartao__texto">
                  <span className="cartao__titulo">{trajeto.nome}</span>
                  <span className="mudo">
                    {resumoDias(trajeto.diasSemana)} · {resumoJanela(trajeto.horaInicio, trajeto.horaFim)}
                  </span>
                  <span className={estado.destaque ? 'situacao situacao--valendo' : 'situacao'}>
                    {estado.texto}
                  </span>
                </div>
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Excluir o trajeto ${trajeto.nome}`}
                  onClick={() => {
                    if (window.confirm(`Excluir o trajeto "${trajeto.nome}"?`)) {
                      void executar(() => api.removerTrajeto(trajeto.id));
                    }
                  }}
                >
                  <Icone nome="lixeira" tamanho={20} />
                </button>
                <button
                  type="button"
                  role="switch"
                  className="chave"
                  aria-checked={trajeto.ativo}
                  aria-label={`Avisos do trajeto ${trajeto.nome}`}
                  onClick={() =>
                    void executar(() => api.atualizarTrajeto(trajeto.id, { ativo: !trajeto.ativo }))
                  }
                >
                  <span className="chave__trilho">
                    <span className="chave__botao" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Link to="/trajetos/novo" className="botao botao--tracejado">
          <Icone nome="mais" tamanho={22} espessura={2.4} />
          Novo trajeto
        </Link>
      </main>
      <BarraAbas />
    </div>
  );
}
