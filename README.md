# Poker Friends

Texas Hold'em cash-style para jogar com amigos. Salas privadas por código curto, até 10 assentos, UI em português. Login com **Google** (Auth.js / NextAuth v5, sessões JWT).

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Auth.js (NextAuth v5)** + Google OAuth — JWT (sem Postgres para auth)
- **Persistência de salas:** [Upstash Redis](https://upstash.com) (REST)
- **Realtime:** polling HTTP ~1,5s (Vercel-friendly)
- Fallback **in-memory** para salas se Redis não estiver configurado (só local)

## Como jogar localmente

1. Copie `.env.example` → `.env.local` e preencha Auth + (opcional) Redis.  
   Segredo e checklist: ver também o doc de env do projeto (`docs/vercel-env.md` no agent store / README abaixo).
2. Configure o OAuth no Google (redirect local abaixo).
3. Rode:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

1. **Entrar com Google**
2. Ajuste o apelido (padrão = nome do Google) → **Criar sala**
3. Compartilhe o código; outro jogador logado entra e senta
4. Anfitrião → **Iniciar mão** (mín. 2 sentados)
5. Fold / Check / Call / Bet / Raise

## Google Cloud (OAuth)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create OAuth client ID** (Web application).
2. **Authorized JavaScript origins**
   - `http://localhost:3000`
   - `https://SEU-DOMINIO.vercel.app`
3. **Authorized redirect URIs** (obrigatório — Auth.js):

   ```
   {origin}/api/auth/callback/google
   ```

   Exemplos:

   - `http://localhost:3000/api/auth/callback/google`
   - `https://SEU-DOMINIO.vercel.app/api/auth/callback/google`

4. Cole Client ID / Secret em `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET`.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `AUTH_SECRET` | Sim | Segredo JWT (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Sim | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Sim | Google OAuth Client Secret |
| `AUTH_TRUST_HOST` | Recomendado (`true`) | Necessário na Vercel |
| `AUTH_URL` | Opcional | Ex.: `http://localhost:3000` |
| `UPSTASH_REDIS_REST_URL` | Produção | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Produção | Redis REST token |

Exemplo `.env.local`:

```env
AUTH_SECRET=gere-com-openssl
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=xxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=xxxxx
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
```

Salas no Redis expiram em **24h** (TTL renovado a cada save).

## Deploy na Vercel

1. Redis no [Upstash](https://console.upstash.com).
2. OAuth no Google com redirect `{seu-dominio}/api/auth/callback/google`.
3. Importe o repo → configure **todas** as env vars → Deploy.

```bash
npx vercel
```

## API (resumo)

Todas as rotas de sala (exceto `GET /api/rooms` health) exigem sessão Google.

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/api/rooms` | Criar sala `{ nickname? }` — `playerId` = user Google |
| `GET` | `/api/rooms/:code` | Estado (cartas só do viewer / showdown) |
| `POST` | `/api/rooms/:code/join` | Entrar `{ nickname? }` |
| `POST` | `/api/rooms/:code/sit` | Sentar `{ seat }` |
| `POST` | `/api/rooms/:code/start` | Anfitrião inicia mão |
| `POST` | `/api/rooms/:code/action` | `{ action, amount? }` |

## Limitações do MVP

- Auth só Google (JWT); sem adapter de banco para usuários.
- Sem side pots complexos; pot único.
- Polling ~1–2s.
- Memory store não escala em multi-instância — use Upstash em produção.
