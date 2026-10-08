// Barramento mínimo: quem muda dados chama invalidar() e todas as consultas
// abertas (useConsulta) buscam de novo.

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

export function invalidar(): void {
  for (const ouvinte of [...ouvintes]) ouvinte();
}

export function aoInvalidar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
