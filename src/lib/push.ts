import { api, ehMock } from '../api';

export type ResultadoPush =
  | 'ativado'
  | 'negado'
  | 'sem-suporte'
  | 'sem-service-worker'
  | 'sem-chave'
  | 'erro';

export const TEXTO_RESULTADO_PUSH: Record<ResultadoPush, string> = {
  ativado: 'Ligadas neste aparelho.',
  negado: 'Bloqueadas. Libere nas configurações do navegador para este site.',
  'sem-suporte':
    'Este navegador não oferece notificações aqui. No iPhone, adicione o app à Tela de Início primeiro.',
  'sem-service-worker':
    'Notificações só funcionam na versão publicada (npm run build), não no npm run dev.',
  'sem-chave': 'Falta a chave VAPID pública (VITE_VAPID_PUBLIC_KEY) na configuração do app.',
  erro: 'Não consegui ligar as notificações. Tente de novo.',
};

/** Chave VAPID em base64url → bytes, como o PushManager pede. */
function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const binario = atob(preenchido.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Pede permissão (se ainda não foi dada), assina o Web Push deste aparelho
 * e guarda a assinatura no servidor. No mock só pede a permissão.
 */
export async function ativarPush(): Promise<ResultadoPush> {
  if (typeof Notification === 'undefined') return 'sem-suporte';
  const permissao =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permissao !== 'granted') return 'negado';
  if (ehMock) return 'ativado';

  const chave = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!chave) return 'sem-chave';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'sem-suporte';
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return 'sem-service-worker';

  try {
    const pronto = await navigator.serviceWorker.ready;
    const servidor = chaveParaBytes(chave);
    let assinatura = await pronto.pushManager.getSubscription();
    if (assinatura) {
      // Se a chave VAPID mudou, a assinatura antiga não serve mais.
      const atual = assinatura.options.applicationServerKey;
      const mesma =
        atual && new Uint8Array(atual).every((byte, i) => byte === servidor[i]) && atual.byteLength === servidor.length;
      if (!mesma) {
        await assinatura.unsubscribe();
        assinatura = null;
      }
    }
    assinatura ??= await pronto.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: servidor,
    });
    const json = assinatura.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'erro';
    await api.registrarAssinaturaPush({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return 'ativado';
  } catch (erro) {
    console.error('Falha ao assinar push', erro);
    return 'erro';
  }
}

/** Ao abrir o app logado: se a permissão já existe, renova a assinatura no servidor. */
export async function sincronizarPush(): Promise<void> {
  if (ehMock || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  await ativarPush();
}
