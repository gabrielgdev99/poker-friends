# Poker Friends

Texas Hold'em cash-style para jogar com amigos. Salas privadas por código curto, até 10 assentos, UI em português.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Persistência:** [Upstash Redis](https://upstash.com) (REST) — serverless-friendly na Vercel
- **Realtime:** polling HTTP a cada ~1,5s (sem WebSocket / Durable Objects)
- Fallback **in-memory** se as env vars do Redis não estiverem setadas (ok para `npm run dev` local em um único processo)

## Como jogar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

1. Digite um apelido → **Criar sala** (você vira anfitrião no assento 1).
2. Compartilhe o código de 5 caracteres.
3. Outro jogador (outra aba/incógnito) → cola o código → **Entrar** → toca em um assento.
4. Anfitrião → **Iniciar mão** (mín. 2 sentados).
5. Ações: Fold, Check/Call, Bet/Raise. Botão do dealer, blinds e showdown inclusos.

Sem Redis local, o estado vive na memória do processo Node — reiniciar o servidor apaga as salas.

## Variáveis de ambiente

Crie `.env.local` (e na Vercel → Project Settings → Environment Variables):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `UPSTASH_REDIS_REST_URL` | Produção | URL REST do banco Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Produção | Token REST do Upstash |

Sem essas vars o app usa store em memória (`GET /api/rooms` devolve `{ store: "memory" }`).

Exemplo `.env.local`:

```env
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
```

Salas no Redis expiram em **24h** (TTL renovado a cada save).

## Deploy na Vercel

1. Crie um Redis em [console.upstash.com](https://console.upstash.com) (região perto da Vercel).
2. Importe o repo no [Vercel](https://vercel.com/new).
3. Configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
4. Deploy. Framework preset: Next.js.

```bash
npx vercel
```

## API (resumo)

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/api/rooms` | Criar sala `{ nickname, playerId? }` |
| `GET` | `/api/rooms/:code?playerId=` | Estado público (cartas só do viewer / showdown) |
| `POST` | `/api/rooms/:code/join` | Entrar |
| `POST` | `/api/rooms/:code/sit` | Sentar `{ playerId, seat }` |
| `POST` | `/api/rooms/:code/start` | Anfitrião inicia mão |
| `POST` | `/api/rooms/:code/action` | `{ playerId, action, amount? }` — fold/check/call/bet/raise |

`playerId` fica em `localStorage` no browser.

## Limitações do MVP

- Sem autenticação pesada (só apelido + código).
- Sem rebuy / side pots complexos (all-in curto ok; pot único).
- Polling, não push — latência ~1–2s, suficiente para jogo em casa.
- Store memory não escala em multi-instância Vercel — use Upstash em produção.
