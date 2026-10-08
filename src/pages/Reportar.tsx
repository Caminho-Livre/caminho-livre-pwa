import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { TipoAlerta } from '../api/tipos';
import { avisar } from '../components/Avisos';
import { Cabecalho, Erro } from '../components/Estrutura';
import { Icone, ICONE_DO_TIPO } from '../components/Icone';
import { Mapa } from '../components/Mapa';
import { invalidar } from '../lib/eventos';
import { obterPosicao, type PosicaoObtida } from '../lib/localizacao';
import { DETALHES_POR_TIPO, NOME_TIPO, TIPOS } from '../lib/rotulos';

export default function Reportar() {
  const navegar = useNavigate();
  const [local, setLocal] = useState<(PosicaoObtida & { descricao: string }) | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoAlerta | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obterPosicao()
      .then(async (obtida) => {
        const descricao = await api.descreverLocal(obtida.posicao);
        if (vivo) setLocal({ ...obtida, descricao });
      })
      .catch((falha: unknown) => {
        if (vivo) setErroLocal(falha instanceof Error ? falha.message : 'Sem localização.');
      });
    return () => {
      vivo = false;
    };
  }, []);

  function escolherTipo(novo: TipoAlerta) {
    setTipo(novo);
    setDetalhes([]);
  }

  function alternarDetalhe(detalhe: string) {
    setDetalhes((atuais) =>
      atuais.includes(detalhe) ? atuais.filter((d) => d !== detalhe) : [...atuais, detalhe],
    );
  }

  async function enviar() {
    if (!tipo || !local) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.criarRelato({ tipo, posicao: local.posicao, detalhes });
      invalidar();
      avisar({ titulo: 'Relato enviado', texto: 'Quem passa por ali já está sendo avisado.' });
      navegar('/', { replace: true });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui enviar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <div className="tela__rolagem">
        <Cabecalho titulo="Reportar" voltarPara="/" rotuloVoltar="Voltar ao mapa" />

        <div className="mapa-trecho">
          <Mapa rotulo="Sua posição no mapa" posicao={local?.posicao} estatico />
        </div>

        <div className="local">
          <span className="local__icone">
            <Icone nome="pino" />
          </span>
          <div className="cartao__texto">
            {local ? (
              <>
                <span className="cartao__titulo">{local.descricao}</span>
                <span className="mudo">
                  {local.simulada
                    ? 'Posição simulada (modo de teste).'
                    : 'O relato vale para onde você está agora.'}
                </span>
              </>
            ) : erroLocal ? (
              <span className="erro">{erroLocal}</span>
            ) : (
              <span className="mudo">Buscando sua posição…</span>
            )}
          </div>
        </div>

        <h2 className="secao">O que você viu?</h2>
        <div className="grade-2">
          {TIPOS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              className="tipo"
              aria-pressed={tipo === opcao}
              onClick={() => escolherTipo(opcao)}
            >
              <Icone nome={ICONE_DO_TIPO[opcao]} tamanho={28} />
              {NOME_TIPO[opcao]}
            </button>
          ))}
        </div>

        {tipo ? (
          <>
            <h2 className="secao">
              Detalhes <span className="mudo secao__opcional">(opcional)</span>
            </h2>
            <div className="chips">
              {DETALHES_POR_TIPO[tipo].map((detalhe) => (
                <button
                  key={detalhe}
                  type="button"
                  className="chip"
                  aria-pressed={detalhes.includes(detalhe)}
                  onClick={() => alternarDetalhe(detalhe)}
                >
                  {detalhe}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="espaco" />

        {erro ? <Erro>{erro}</Erro> : null}

        <button className="botao" type="button" disabled={!tipo || !local || enviando} onClick={enviar}>
          Enviar relato
        </button>
        <p className="nota">Só reporte com o carro parado ou como passageiro.</p>
      </div>
    </main>
  );
}
