/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Nome antigo da chave pública do Supabase; aceito no lugar da publishable. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Chave pública VAPID (a mesma configurada na Edge Function notificar). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** WhatsApp que recebe o feedback dos testers, com DDI e DDD (ex.: 5561999999999). */
  readonly VITE_FEEDBACK_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
