import type { Api } from './contrato';
import { criarApiMock, type FerramentasDeTeste } from './mock/mockApi';

// Ponto único de troca entre mock e backend real.
//
// Quando a API existir, crie src/api/http/httpApi.ts implementando `Api` com
// fetch e escolha aqui, por exemplo:
//
//   export const ehMock = import.meta.env.VITE_API !== 'http';
//   export const api = ehMock ? mock.api : criarApiHttp(import.meta.env.VITE_API_URL);
//
// As telas só importam deste arquivo, então nada mais muda.

const mock = criarApiMock();

export const ehMock = true;

export const api: Api = mock.api;

/** Só existe no mock. As telas checam `ehMock` antes de mostrar. */
export const ferramentasDeTeste: FerramentasDeTeste = mock.ferramentas;

export { CODIGO_DE_TESTE } from './mock/mockApi';
export { ErroApi } from './contrato';
export type * from './tipos';
