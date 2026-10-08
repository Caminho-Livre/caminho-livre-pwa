const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function minutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * O trajeto vale agora? `dias` usa 0 = domingo … 6 = sábado.
 * Uma janela que cruza a meia-noite (22:00–02:00) pertence ao dia em que começa.
 */
export function dentroDaJanela(dias: number[], inicio: string, fim: string, agora: Date): boolean {
  const minuto = agora.getHours() * 60 + agora.getMinutes();
  const hoje = agora.getDay();
  const ini = minutosDoDia(inicio);
  const ate = minutosDoDia(fim);
  if (ini <= ate) return dias.includes(hoje) && minuto >= ini && minuto <= ate;
  const ontem = (hoje + 6) % 7;
  return (dias.includes(hoje) && minuto >= ini) || (dias.includes(ontem) && minuto <= ate);
}

/** "07:00" → "7h", "17:30" → "17h30". */
export function formatarHora(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function resumoJanela(inicio: string, fim: string): string {
  if (minutosDoDia(inicio) === 0 && minutosDoDia(fim) >= 23 * 60 + 59) return 'o dia todo';
  return `${formatarHora(inicio)} às ${formatarHora(fim)}`;
}

export function resumoDias(dias: number[]): string {
  const unicos = [...new Set(dias)];
  if (unicos.length === 0) return 'nenhum dia';
  if (unicos.length === 7) return 'todos os dias';
  // Semana começando na segunda, como se fala no Brasil.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const ordenados = ordem.filter((d) => unicos.includes(d));
  const chave = ordenados.join(',');
  if (chave === '1,2,3,4,5') return 'seg a sex';
  if (chave === '1,2,3,4,5,6') return 'seg a sáb';
  if (chave === '6,0') return 'sáb e dom';
  return ordenados.map((d) => NOMES_DIAS[d]).join(', ');
}

/** "agora", "há 6 min", "há 2 h". */
export function haQuanto(iso: string, agora: Date): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h`;
}

/** "40 min", "2 h". Devolve null se já passou. */
export function quantoFalta(iso: string, agora: Date): string | null {
  const minutos = Math.ceil((new Date(iso).getTime() - agora.getTime()) / 60_000);
  if (minutos <= 0) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `${horas} h`;
}

const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Data "de parede" no fuso pedido: um Date cujos getDay/getHours/getMinutes
 * locais mostram a hora daquele fuso. Serve só para comparar com janelas.
 */
export function horaNoFuso(agora: Date, fuso: string | undefined): Date {
  if (!fuso) return agora;
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(agora);
    const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
    const dia = DIAS_EN.indexOf(valor('weekday'));
    if (dia < 0) return agora;
    // Um domingo qualquer (4/10/2026) mais o dia da semana do fuso.
    return new Date(2026, 9, 4 + dia, Number(valor('hour')), Number(valor('minute')));
  } catch {
    return agora;
  }
}

/** O trajeto está ligado e dentro da janela, na hora local de quem o criou? */
export function trajetoValendo(
  trajeto: { ativo: boolean; diasSemana: number[]; horaInicio: string; horaFim: string; fuso?: string },
  agora: Date,
): boolean {
  return (
    trajeto.ativo &&
    dentroDaJanela(trajeto.diasSemana, trajeto.horaInicio, trajeto.horaFim, horaNoFuso(agora, trajeto.fuso))
  );
}
