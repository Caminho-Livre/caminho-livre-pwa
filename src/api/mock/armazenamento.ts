// Persistência do mock: localStorage quando existe (browser), memória quando
// não (testes em Node, navegação privada que bloqueia storage).

const memoria = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = storage()?.getItem(chave) ?? memoria.get(chave) ?? null;
    return bruto === null ? padrao : (JSON.parse(bruto) as T);
  } catch {
    return padrao;
  }
}

export function gravar<T>(chave: string, valor: T): void {
  const bruto = JSON.stringify(valor);
  memoria.set(chave, bruto);
  try {
    storage()?.setItem(chave, bruto);
  } catch {
    // Sem espaço ou storage bloqueado: segue só em memória.
  }
}

export function apagar(chave: string): void {
  memoria.delete(chave);
  try {
    storage()?.removeItem(chave);
  } catch {
    // Idem.
  }
}
