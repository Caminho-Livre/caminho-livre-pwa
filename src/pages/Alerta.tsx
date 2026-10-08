import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { avisar } from '../components/Avisos';
import { Cabecalho, Carregando, Erro } from '../components/Estrutura';
import { Icone } from '../components/Icone';
import { Mapa } from '../components/Mapa';
import { useConsulta } from '../hooks/useConsulta';
import { invalidar } from '../lib/eventos';
import { agora } from '../lib/relogio';
import { NOME_TIPO } from '../lib/rotulos';
import { haQuanto, quantoFalta } from '../lib/tempo';

async function carregar(id: string) {
  const [alerta, noCaminho, trajetos] = await Promise.all([
    api.obterAlerta(id),
    api.alertasNoCaminho(),
    api.listarTrajetos(),
  ]);
  const cruzamento = noCaminho.find((item) => item.alerta.id === id) ?? null;
  const trajeto = cruzamento ? (trajetos.find((t) => t.id === cruzamento.trajetoId) ?? null) : null;
  return { alerta, trajeto };
}

export default function Alerta() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const { dados, erro, carregando } = useConsulta(() => carregar(id), [id]);
  const [enviando, setEnviando] = useState(false);
  const [erroResposta, setErroResposta] = useState<string | null>(null);

  async function responder(aindaEsta: boolean) {
    setErroResposta(null);
    setEnviando(true);
    try {
      await api.responderAlerta(id, aindaEsta);
      invalidar();
      avisar({
        titulo: 'Obrigado',
        texto: aindaEsta ? 'O alerta segue valendo por mais um tempo.' : 'O alerta saiu do mapa.',
      });
      navegar('/', { replace: true });
    } catch (falha) {
      setErroResposta(falha instanceof Error ? falha.message : 'Não consegui registrar.');
      setEnviando(false);
    }
  }

  const alerta = dados?.alerta ?? null;
  const trajeto = dados?.trajeto ?? null;
  const instante = agora();
  const falta = alerta ? quantoFalta(alerta.expiraEm, instante) : null;
  const ativo = alerta?.status === 'ativo';

  return (
    <main className="tela">
      <div className="tela__rolagem">
        <Cabecalho
          voltarPara="/"
          rotuloVoltar="Voltar ao mapa"
          sobretitulo={trajeto ? 'No seu caminho' : undefined}
          titulo={trajeto ? undefined : 'Alerta'}
        />

        {carregando ? <Carregando /> : null}
        {erro ? <Erro>{erro.message}</Erro> : null}
        {!carregando && !erro && !alerta ? <Erro>Este alerta não existe mais.</Erro> : null}

        {alerta ? (
          <>
            <div className="mapa-trecho mapa-trecho--alto">
              <Mapa
                rotulo="Onde está o alerta"
                rotas={trajeto ? [{ pontos: trajeto.rota }] : []}
                pinos={[
                  { id: alerta.id, tipo: alerta.tipo, posicao: alerta.posicao, noCaminho: Boolean(trajeto) },
                ]}
                posicao={null}
                estatico
              />
            </div>

            <div>
              <h1 className="titulo-medio">{NOME_TIPO[alerta.tipo]}</h1>
              <p className="subtitulo">{alerta.descricaoLocal}</p>
            </div>

            <dl className="fatos">
              <div>
                <dt>Primeiro relato</dt>
                <dd>{haQuanto(alerta.criadoEm, instante)}</dd>
              </div>
              <div>
                <dt>Quem relatou</dt>
                <dd>{alerta.relatos === 1 ? '1 pessoa' : `${alerta.relatos} pessoas`}</dd>
              </div>
              {alerta.detalhes.length ? (
                <div>
                  <dt>Detalhe</dt>
                  <dd>{alerta.detalhes.join(', ')}</dd>
                </div>
              ) : null}
              {trajeto ? (
                <div>
                  <dt>Seu trajeto</dt>
                  <dd>{trajeto.nome}</dd>
                </div>
              ) : null}
            </dl>

            <div className="espaco" />

            {ativo ? (
              <>
                <h2 className="titulo-pergunta">Ainda está lá?</h2>
                {erroResposta ? <Erro>{erroResposta}</Erro> : null}
                <div className="grade-2">
                  <button className="botao" type="button" disabled={enviando} onClick={() => responder(true)}>
                    <Icone nome="sim" tamanho={22} espessura={2.6} />
                    Sim, está
                  </button>
                  <button
                    className="botao botao--secundario"
                    type="button"
                    disabled={enviando}
                    onClick={() => responder(false)}
                  >
                    <Icone nome="nao" tamanho={22} espessura={2.6} />
                    Não está mais
                  </button>
                </div>
                <p className="nota">
                  {falta
                    ? `Sem confirmação, este alerta expira em ${falta}.`
                    : 'Este alerta está para expirar.'}
                </p>
              </>
            ) : (
              <p className="nota nota--destaque">
                {alerta.status === 'expirado'
                  ? 'Este alerta expirou: ninguém confirmou a tempo.'
                  : 'Este alerta foi encerrado: avisaram que não está mais lá.'}
              </p>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
