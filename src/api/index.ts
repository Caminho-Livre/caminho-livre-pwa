import type { Api } from './contrato';
import { criarApiMock, type FerramentasDeTeste } from './mock/mockApi';
import { criarApiSupabase } from './supabase/supabaseApi';

// Ponto único de troca entre mock e backend.
//
// Com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY definidas (arquivo
// .env.local ou variáveis na Vercel), o app usa o Supabase. Sem elas, roda
// com o mock local. As telas só importam deste arquivo.

const urlSupabase = import.meta.env.VITE_SUPABASE_URL;
const chaveSupabase =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const ehMock = !urlSupabase || !chaveSupabase;

const mock = criarApiMock();

export const api: Api = ehMock
  ? mock.api
  : criarApiSupabase(urlSupabase!, chaveSupabase!);

/** Só existe no mock. As telas checam `ehMock` antes de mostrar. */
export const ferramentasDeTeste: FerramentasDeTeste = mock.ferramentas;

export { CODIGO_DE_TESTE } from './mock/mockApi';
export { ErroApi } from './contrato';
export type * from './tipos';
