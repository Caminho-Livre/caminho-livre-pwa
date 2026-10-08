# caminho-livre-pwa

App web (PWA) do Caminho Livre em React + TypeScript + Vite. Publicado na
Vercel como site estático. O backend está no projeto `caminho-livre-api`
(Supabase).

O app roda de dois jeitos:

- **Mock local:** sem variáveis de ambiente, tudo fica no navegador. Bom para
  mexer nas telas.
- **Com o Supabase:** com as variáveis abaixo, fala com o
  `caminho-livre-api`.

O nome "Caminho Livre" é provisório.

## Rodar na sua máquina

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # checa tipos e gera dist/
npm run preview    # serve o dist/ em http://localhost:4173
```

Para falar com o Supabase localmente, copie `.env.example` para `.env.local` e
preencha. Notificações só funcionam na versão publicada ou no `npm run preview`.

## Publicar na Vercel

1. Coloque o `caminho-livre-api` no ar primeiro (veja o README dele).
2. Suba esta pasta para um repositório no GitHub e importe na Vercel. Ela
   reconhece o Vite sozinha; o `vercel.json` cuida das rotas do app.
3. Em **Settings → Environment Variables**, cadastre:

| Variável | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable (`sb_publishable_…`) |
| `VITE_VAPID_PUBLIC_KEY` | chave VAPID **pública** (a mesma cadastrada no Supabase) |
| `VITE_FEEDBACK_WHATSAPP` | opcional: seu WhatsApp, só dígitos com 55 e DDD (ex.: `5561999999999`). Liga o botão "Mandar feedback" na tela Conta |

São as únicas. Todas são públicas: entram no app na hora do build (o número do
WhatsApp fica visível no código do app), então depois de mudar alguma, faça um
novo deploy.

## Testar com outras pessoas

Mande a URL `https://` da Vercel. O app conduz o resto:

- **Android:** a pessoa entra, salva um trajeto e o app mostra o cartão
  **Ligue os avisos do celular**, com o botão que pede a permissão. Enquanto os
  avisos estiverem desligados, o cartão fica no Início e em Trajetos.
- **iPhone:** no Safari, antes de criar a conta, o app mostra o passo a passo
  para **Adicionar à Tela de Início**. O iOS só entrega push para app
  instalado, e o app instalado não enxerga a conta criada no Safari, por isso
  a instalação vem primeiro. Dá para pular ("Usar no Safari mesmo assim"),
  mas sem avisos.

Para ver o push são precisos dois aparelhos: um salva um trajeto, o outro
relata algo em cima dele. Quem liga os avisos ou entra no horário do trajeto
depois do relato recebe o aviso em até um minuto (varredura do backend).

Tocar no aviso abre o alerta e registra a abertura no banco, para medir o
teste (veja `supabase/consultas/metricas.sql` no `caminho-livre-api`).

## Serviços externos

O app usa diretamente, sem chave, serviços públicos do OpenStreetMap:

- **OSRM** (servidor de demonstração) para rotas.
- **Nominatim** para busca de endereço e nome do local do relato. O limite é
  de uma busca por segundo e não pode buscar enquanto se digita; o app
  respeita as duas regras.
- **Tiles do OpenStreetMap** para o mapa.

São gratuitos com regra de uso justo: servem para um grupo de teste. Para
crescer, troque por um provedor (Mapbox, MapTiler, OpenRouteService) em
`src/api/supabase/supabaseApi.ts` e `URL_TILES` em `src/components/Mapa.tsx`.

## Modo mock

1. Entre com qualquer celular com DDD (ex.: `61 90000-0000`) e o código `123456`.
2. **Conta → Carregar dados de exemplo:** dois trajetos e três alertas no DF.
3. **Simular relato no meu trajeto:** outro usuário reporta no seu caminho e o
   aviso chega pelo mesmo caminho que um push.
4. **Simular relato fora do trajeto:** aparece no mapa, não avisa.
5. **Relógio +30 min:** adianta a hora para ver alertas expirando.

A posição simulada vem ligada no mock: seus relatos saem de um ponto do seu
trajeto no DF.

## Estrutura

```
src/
  api/
    contrato.ts          interface Api: o contrato entre telas e backend
    tipos.ts             Trajeto, Relato, Alerta…
    index.ts             escolhe mock ou Supabase pelas variáveis de ambiente
    mock/                implementação local + regras em TypeScript
    supabase/            implementação com Supabase, OSRM e Nominatim
  lib/                   geometria, janelas de horário com fuso, push, localização
  components/            Mapa (Leaflet), avisos, abas, ícones
  pages/                 as telas
public/sw-push.js        recebe o push no service worker e abre o alerta ao tocar
```

Para trocar o Supabase pela API Java no futuro, implemente `Api` com `fetch`
em `src/api/` e escolha essa implementação em `src/api/index.ts`. As funções
SQL do `caminho-livre-api` e `src/api/mock/regras.ts` descrevem o
comportamento que a API precisa manter.
