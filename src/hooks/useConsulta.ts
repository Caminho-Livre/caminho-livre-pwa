import { useEffect, useRef, useState, type DependencyList } from 'react';
import { aoInvalidar } from '../lib/eventos';

export interface Consulta<T> {
  dados: T | undefined;
  erro: Error | null;
  carregando: boolean;
}

/**
 * Busca dados da API e busca de novo quando as dependências mudam, quando
 * alguém chama invalidar() e, opcionalmente, a cada `intervaloMs`.
 */
export function useConsulta<T>(
  buscar: () => Promise<T>,
  deps: DependencyList = [],
  opcoes: { intervaloMs?: number } = {},
): Consulta<T> {
  const [estado, setEstado] = useState<Consulta<T>>({
    dados: undefined,
    erro: null,
    carregando: true,
  });
  const funcao = useRef(buscar);
  funcao.current = buscar;
  const { intervaloMs } = opcoes;

  useEffect(() => {
    let vivo = true;
    let pedido = 0;
    const rodar = () => {
      const meu = ++pedido;
      funcao.current().then(
        (dados) => {
          if (vivo && meu === pedido) setEstado({ dados, erro: null, carregando: false });
        },
        (erro: unknown) => {
          if (vivo && meu === pedido) {
            setEstado((anterior) => ({
              dados: anterior.dados,
              erro: erro instanceof Error ? erro : new Error(String(erro)),
              carregando: false,
            }));
          }
        },
      );
    };
    rodar();
    const parar = aoInvalidar(rodar);
    const temporizador = intervaloMs ? window.setInterval(rodar, intervaloMs) : undefined;
    return () => {
      vivo = false;
      parar();
      if (temporizador !== undefined) window.clearInterval(temporizador);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervaloMs]);

  return estado;
}
