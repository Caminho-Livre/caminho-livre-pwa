import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Usuario } from '../api/tipos';

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar(usuario: Usuario): void;
  sair(): Promise<void>;
}

const Contexto = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .usuarioAtual()
      .then((u) => vivo && setUsuario(u))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const sair = useCallback(async () => {
    await api.sair();
    setUsuario(null);
  }, []);

  const valor = useMemo<Sessao>(
    () => ({ usuario, carregando, entrar: setUsuario, sair }),
    [usuario, carregando, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const sessao = useContext(Contexto);
  if (!sessao) throw new Error('useSessao precisa estar dentro de ProvedorSessao.');
  return sessao;
}
