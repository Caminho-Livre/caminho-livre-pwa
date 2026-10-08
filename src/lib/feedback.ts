/** Link do WhatsApp para feedback, ou null se o número não foi configurado. */
export function linkFeedback(usuarioId: string | undefined): string | null {
  const numero = (import.meta.env.VITE_FEEDBACK_WHATSAPP ?? '').replace(/\D/g, '');
  if (numero.length < 10) return null;
  // O código da conta ajuda a achar os relatos e pushes da pessoa no banco.
  const conta = usuarioId ? ` (conta ${usuarioId.slice(0, 8)})` : '';
  const texto = `Feedback do Caminho Livre${conta}: `;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
