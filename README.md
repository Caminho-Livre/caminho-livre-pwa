# Caminho Livre — base do PWA

App web (PWA) em React + TypeScript + Vite. Não há backend: todas as chamadas
de API caem num mock interno que guarda os dados no `localStorage` do
navegador. O nome "Caminho Livre" é provisório.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes das regras, da geometria e do mock
npm run build      # checa tipos e gera dist/ com service worker e manifest
npm run preview    # serve o dist/ em http://localhost:4173
```

O service worker só existe no build. Para testar instalação na tela inicial e
notificações do sistema, use `npm run build && npm run preview`.

## Como testar o fluxo

1. Entre com qualquer celular com DDD (ex.: `61 90000-0000`) e o código `123456`.
2. Vá em **Conta → Carregar dados de exemplo**: dois trajetos e três alertas no
   DF, um deles em cima do trajeto "Casa → Trabalho".
3. **Simular relato no meu trajeto** faz o papel de outro usuário reportando
   algo no seu caminho. O aviso chega pelo mesmo caminho que um push real.
4. **Simular relato fora do trajeto** cria um alerta que aparece no mapa, mas
   não avisa.
5. **Relógio +30 min** adianta a hora do app para ver alertas expirando.

A **posição simulada** vem ligada: seus relatos saem de um ponto do seu trajeto
no DF. Desligue na tela Conta para usar o GPS do aparelho.

## Estrutura

```
src/
  api/
    contrato.ts        interface Api: o contrato entre telas e backend
    tipos.ts           Trajeto, Relato, Alerta…
    index.ts           ponto único de troca entre mock e backend real
    mock/
      mockApi.ts       implementação mock + ferramentas de teste
      regras.ts        agrupamento de relatos, TTL, "ainda está lá?", cruzamento
      lugares.ts       lugares do DF para a busca (coordenadas aproximadas)
  lib/
    geo.ts             distância ponto–rota (o ST_DWithin local)
    tempo.ts           janela de dias e horário, textos de tempo
    relogio.ts         relógio único (permite adiantar no teste)
    localizacao.ts     GPS ou posição simulada
    notificacoes.ts    permissão e notificação do sistema
  components/          Mapa (Leaflet), Avisos, abas, ícones
  pages/               Entrar, Inicio, Reportar, Alerta, Trajetos, NovoTrajeto, Conta
public/
  sw-push.js           clique em notificação e evento "push" (para o Web Push real)
```

## Trocar o mock pelo backend

As telas só importam de `src/api/index.ts`. Para ligar na API real:

1. Crie `src/api/http/httpApi.ts` implementando a interface `Api` com `fetch`.
2. Em `src/api/index.ts`, exporte essa implementação no lugar do mock e ponha
   `ehMock = false` (some a seção de ferramentas de teste e a posição simulada).
3. `aoReceberPush` passa a ouvir mensagens do service worker; o evento `push`
   já está tratado em `public/sw-push.js` e espera o payload
   `{ "titulo", "corpo", "url" }`.

`src/api/mock/regras.ts` é a especificação do comportamento que o backend
precisa reproduzir. Os parâmetros estão no objeto `REGRAS`:

| Parâmetro | Valor inicial |
| --- | --- |
| Distância máxima entre alerta e rota | 80 m |
| Raio para juntar relatos do mesmo tipo | 150 m |
| Relatos para o alerta aparecer | 1 |
| Negativas para derrubar o alerta | 1 |
| Validade: blitz / radar / bloqueio / acidente | 40 / 60 / 120 / 60 min |

## O que é de mentira no mock

- **Login:** nenhum SMS é enviado; o código é sempre `123456`.
- **Rotas:** não há roteador. As duas opções de caminho são curvas entre origem
  e destino, não ruas de verdade.
- **Lugares:** uma lista fixa de 17 pontos do DF.
- **Push:** só chega com o app aberto, disparado pelas ferramentas de teste.
- **Outros usuários:** não existem; os relatos deles são simulados.

## Testar no celular

Service worker, notificações e GPS exigem HTTPS (ou `localhost`). Para abrir no
celular, publique o `dist/` num host estático com HTTPS e fallback de SPA para
`index.html`, ou use um túnel HTTPS para a sua máquina. Pelo IP da rede local
em HTTP o app abre, mas sem instalação, notificação e GPS.

No iPhone, notificações só funcionam depois de adicionar o app à Tela de Início.

### Vercel

O `vercel.json` manda toda rota que não for arquivo para o `index.html`. Sem
isso, abrir direto `/trajetos` ou o link de uma notificação (`/alerta/…`) dá 404.
A Vercel reconhece o Vite sozinha: build `npm run build`, saída `dist`.

## Mapa

O mapa usa Leaflet com os tiles públicos do OpenStreetMap, escurecidos por um
filtro CSS. Serve para desenvolvimento; para produção, troque `URL_TILES` em
`src/components/Mapa.tsx` por um provedor contratado ou tiles próprios.
