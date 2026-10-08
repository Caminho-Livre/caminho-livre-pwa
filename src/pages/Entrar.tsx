import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CODIGO_DE_TESTE, api, ehMock } from '../api';
import { Erro } from '../components/Estrutura';
import { Icone } from '../components/Icone';
import { useSessao } from '../hooks/useSessao';

const PASSOS = [
  'Salve o trajeto e o horário em que você passa.',
  'Receba aviso só do que cair nele.',
  'Viu algo na rua? Reporte com um toque.',
];

export default function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState<'telefone' | 'codigo'>('telefone');
  const [telefone, setTelefone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const anonimo = api.modoLogin === 'anonimo';

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void executar(async () => {
      if (anonimo) {
        entrar(await api.entrarAnonimo());
        navegar('/', { replace: true });
      } else if (etapa === 'telefone') {
        await api.solicitarCodigo(telefone);
        setEtapa('codigo');
      } else {
        entrar(await api.confirmarCodigo(telefone, codigo));
        navegar('/', { replace: true });
      }
    });
  }

  return (
    <main className="tela tela--entrar">
      <div className="entrar__marca">
        <div className="entrar__logo">
          <Icone nome="trajetos" tamanho={30} espessura={2.2} />
        </div>
        <h1 className="titulo-grande">Caminho Livre</h1>
        <p className="entrar__chamada">Avisos de blitz, radar e bloqueio só no caminho que você faz.</p>
        <ol className="entrar__passos">
          {PASSOS.map((passo, i) => (
            <li key={passo}>
              <span className="entrar__numero">{i + 1}</span>
              <span>{passo}</span>
            </li>
          ))}
        </ol>
      </div>

      <form className="entrar__form" onSubmit={enviar} noValidate>
        {anonimo ? (
          <p className="nota-teste">
            Versão de teste: sem cadastro. O app cria uma conta só para este aparelho.
          </p>
        ) : etapa === 'telefone' ? (
          <>
            <label className="rotulo" htmlFor="telefone">
              Seu celular
            </label>
            <div className="entrar__telefone">
              <span className="campo campo--prefixo">+55</span>
              <input
                id="telefone"
                className="campo"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(61) 90000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <>
            <label className="rotulo" htmlFor="codigo">
              Código que chegou por SMS
            </label>
            <input
              id="codigo"
              className="campo campo--codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
            {ehMock ? (
              <p className="nota-teste">
                Modo de teste: nenhum SMS é enviado. Use o código {CODIGO_DE_TESTE}.
              </p>
            ) : null}
          </>
        )}

        {erro ? <Erro>{erro}</Erro> : null}

        <button className="botao" type="submit" disabled={enviando}>
          {anonimo ? 'Começar a testar' : etapa === 'telefone' ? 'Receber código por SMS' : 'Entrar'}
        </button>

        {anonimo ? null : etapa === 'codigo' ? (
          <button
            className="botao-texto"
            type="button"
            onClick={() => {
              setEtapa('telefone');
              setCodigo('');
              setErro(null);
            }}
          >
            Trocar o número
          </button>
        ) : (
          <p className="nota">Seu número só serve para evitar relatos falsos. Ninguém vê.</p>
        )}
      </form>
    </main>
  );
}
