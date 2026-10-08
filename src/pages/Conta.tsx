import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ehMock, ferramentasDeTeste } from '../api';
import { avisar } from '../components/Avisos';
import { BarraAbas } from '../components/Estrutura';
import { useSessao } from '../hooks/useSessao';
import { invalidar } from '../lib/eventos';
import { definirModoPosicao, modoPosicao, type ModoPosicao } from '../lib/localizacao';
import { estadoPermissao, pedirPermissao, type EstadoPermissao } from '../lib/notificacoes';
import { adiantarRelogio, minutosAdiantados, zerarRelogio } from '../lib/relogio';
import { NOME_TIPO } from '../lib/rotulos';

const TEXTO_PERMISSAO: Record<EstadoPermissao, string> = {
  granted: 'Ligadas neste aparelho.',
  denied: 'Bloqueadas. Libere nas configurações do navegador para este site.',
  default: 'Desligadas. Sem elas você só vê os alertas com o app aberto.',
  indisponivel:
    'Este navegador não oferece notificações aqui. No iPhone, adicione o app à Tela de Início primeiro.',
};

function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, '');
  if (d.length < 10) return d;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export default function Conta() {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();
  const [permissao, setPermissao] = useState<EstadoPermissao>(estadoPermissao());
  const [posicao, setPosicao] = useState<ModoPosicao>(modoPosicao());
  const [adiantado, setAdiantado] = useState(minutosAdiantados());

  async function simular(noTrajeto: boolean) {
    const resultado = noTrajeto
      ? await ferramentasDeTeste.simularRelatoNoTrajeto()
      : await ferramentasDeTeste.simularRelatoFora();
    if (!resultado) {
      avisar({ titulo: 'Salve um trajeto primeiro', texto: 'Ou carregue os dados de exemplo.' });
      return;
    }
    if (!resultado.notificou) {
      avisar({
        titulo: `Relato sem push: ${NOME_TIPO[resultado.alerta.tipo]}`,
        texto: resultado.motivo,
        para: `/alerta/${resultado.alerta.id}`,
      });
    }
    // Quando notifica, o aviso vem pelo mesmo caminho de um push de verdade (App.tsx).
  }

  function mexerNoRelogio(minutos: number | null) {
    if (minutos === null) zerarRelogio();
    else adiantarRelogio(minutos);
    setAdiantado(minutosAdiantados());
    invalidar();
  }

  return (
    <div className="tela">
      <main className="tela__rolagem tela__rolagem--topo">
        <h1 className="titulo-medio">Conta</h1>

        <section className="bloco">
          <h2 className="secao">Seu celular</h2>
          <p className="subtitulo">+55 {usuario ? formatarTelefone(usuario.telefone) : ''}</p>
        </section>

        <section className="bloco">
          <h2 className="secao">Notificações</h2>
          <p className="mudo">{TEXTO_PERMISSAO[permissao]}</p>
          {permissao === 'default' ? (
            <button
              className="botao botao--secundario"
              type="button"
              onClick={async () => setPermissao(await pedirPermissao())}
            >
              Ligar notificações
            </button>
          ) : null}
        </section>

        {ehMock ? (
          <section className="bloco bloco--teste">
            <h2 className="secao">Ferramentas de teste</h2>
            <p className="mudo">
              O app está rodando com dados locais, sem backend. Nada sai deste aparelho.
            </p>

            <button
              className="botao botao--secundario"
              type="button"
              onClick={async () => {
                await ferramentasDeTeste.carregarExemplo();
                avisar({ titulo: 'Dados de exemplo carregados', texto: 'Dois trajetos e três alertas no DF.' });
                navegar('/');
              }}
            >
              Carregar dados de exemplo
            </button>
            <button className="botao botao--secundario" type="button" onClick={() => void simular(true)}>
              Simular relato no meu trajeto
            </button>
            <button className="botao botao--secundario" type="button" onClick={() => void simular(false)}>
              Simular relato fora do trajeto
            </button>

            <div className="linha-opcao">
              <div className="cartao__texto">
                <span className="cartao__titulo">Posição simulada</span>
                <span className="mudo">
                  {posicao === 'simulada'
                    ? 'Seus relatos saem de um ponto do seu trajeto no DF.'
                    : 'Seus relatos saem do GPS deste aparelho.'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                className="chave"
                aria-checked={posicao === 'simulada'}
                aria-label="Posição simulada"
                onClick={() => {
                  const novo: ModoPosicao = posicao === 'simulada' ? 'gps' : 'simulada';
                  definirModoPosicao(novo);
                  setPosicao(novo);
                }}
              >
                <span className="chave__trilho">
                  <span className="chave__botao" />
                </span>
              </button>
            </div>

            <div className="linha-opcao">
              <div className="cartao__texto">
                <span className="cartao__titulo">Relógio</span>
                <span className="mudo">
                  {adiantado === 0
                    ? 'Hora real. Adiante para ver alertas expirando.'
                    : `Adiantado em ${adiantado} min, até recarregar a página.`}
                </span>
              </div>
              <div className="linha-opcao__acoes">
                <button className="botao-pequeno" type="button" onClick={() => mexerNoRelogio(30)}>
                  +30 min
                </button>
                {adiantado !== 0 ? (
                  <button className="botao-pequeno" type="button" onClick={() => mexerNoRelogio(null)}>
                    Zerar
                  </button>
                ) : null}
              </div>
            </div>

            <button
              className="botao-texto botao-texto--perigo"
              type="button"
              onClick={async () => {
                if (!window.confirm('Apagar trajetos, alertas e relatos deste aparelho?')) return;
                await ferramentasDeTeste.limparDados();
                avisar({ titulo: 'Dados apagados' });
              }}
            >
              Apagar todos os dados locais
            </button>
          </section>
        ) : null}

        <button
          className="botao-texto"
          type="button"
          onClick={async () => {
            await sair();
            navegar('/entrar', { replace: true });
          }}
        >
          Sair
        </button>
      </main>
      <BarraAbas />
    </div>
  );
}
