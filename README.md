# Poker Friends

Texas Hold'em cash-style para jogar com amigos. Salas privadas por código curto, até 10 assentos, UI em português. Login com **Google** (Auth.js / NextAuth v5, sessões JWT).

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Auth.js (NextAuth v5)** + Google OAuth — JWT (sem Postgres para auth)
- **Persistência de salas:** [Upstash Redis](https://upstash.com) (REST)
- **Realtime:** polling HTTP ~1,5s (Vercel-friendly)
- Fallback **in-memory** só no `npm run dev` local — na Vercel Redis é obrigatório (senão criar sala retorna 503)

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
4. Anfitrião → **Adicionar bot** (assentos vazios) se estiver sozinho
5. Anfitrião → **Iniciar mão** (mín. 2 sentados, humanos e/ou bots)
6. Fold / Check / Call / Bet / Raise — bots jogam sozinhos no turno deles

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
| `UPSTASH_REDIS_REST_URL` | **Vercel** | Redis REST URL (obrigatório em produção) |
| `UPSTASH_REDIS_REST_TOKEN` | **Vercel** | Redis REST token |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Alternativa | Aliases aceitos (Vercel KV) |
| `ADMIN_EMAILS` | Opcional | E-mails admin (vírgula). Sem isso: `goncalvesvg1999@gmail.com` |
| `TURN_SECONDS` | Opcional | Timer padrão por turno (8–60). Default **18**. Host pode mudar na sala. |

Exemplo `.env.local`:

```env
AUTH_SECRET=gere-com-openssl
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=xxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=xxxxx
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
# ADMIN_EMAILS=goncalvesvg1999@gmail.com,amigo@example.com
```

Salas no Redis expiram em **24h** (TTL renovado a cada save).

Após deploy, confira `GET /api/rooms` → `"store":"redis"`. Se vier `"memory"`, as salas somem entre requests.

## Mesa / timer / layout

- Timer de decisão **server-side** (Redis): default **18s** (`TURN_SECONDS` ou ajuste do anfitrião: 12/18/25/30).
- Timeout: **check** se grátis, senão **fold**.
- Layout **travado** (`h-dvh`, overflow contido) — mesa + barra de ações sem scroll estranho.
- Chat: **bolha flutuante** (canto inferior direito), fechada por padrão; não rouba espaço da mesa.
- UX: countdown, “Sua vez!”, presets ½ pote / pote / all-in, marcas D / SB / BB.

### Blinds (anfitrião)

Entre mãos, o host ajusta na barra inferior:

1. **SB** inicial (5–100)
2. **Blinds sobem** — liga o schedule
3. Modo **por mãos** (ex.: a cada 4 mãos) ou **por tempo** (ex.: a cada 5 min)
4. Multiplicador **×1.5 / ×2 / ×3** (BB = 2× SB)

Persistido na sala (Redis). O servidor sobe os blinds no `tick` / início de mão. Na mesa: blinds atuais + próximo nível.

### Sair da mesa

Botão **Sair da mesa** (cabeçalho). Volta ao lobby e remove você da sala.

- **Entre mãos:** sai limpo.
- **No meio da mão:** **fold automático** e sai (regra segura — sem limbo). Host passa pro próximo humano se você era anfitrião. Sala vazia (só bots) é apagada.

### Mesas ativas (lobby)

Após login, a home lista **mesas ativas** (código, status, blinds, sentados, host) com **Entrar**. Fonte: índice Redis (`listRooms`).

### Personalização

Na home: **Personalizar** — emoji, cor da ficha, feltro (sua visão). Persistido em Redis (`poker:profile:{userId}`). Aplicado ao entrar/criar sala.

### Falência = espectador

- A **0 fichas**, o jogador **levanta** e fica só assistindo — **sem rebuy** no meio da mesa.
- Só volta a sentar quando a mesa **termina**: ≤1 jogador com fichas (último de pé = campeão da mesa).
- Aí quem faliu recebe stack novo (1000) e pode sentar; o host inicia **Nova mesa** (stacks resetam).

## Bots + chat (galera da igreja)

No lobby (ou após showdown), o **anfitrião** pode:

1. Escolhe o **nível** (Iniciante / Médio / Difícil) → **Chamar bot** — assento livre (até 10)
2. Remover bot — só entre mãos
3. **Iniciar mão** — bots **pensam ~1–3s** antes de agir

Níveis (heurísticas simples): **Iniciante** folda pouco e aposta aleatório; **Médio** equilíbrio; **Difícil** folda mão fraca, raise com sizing de pote. O nível aparece no assento (`Ini` / `Méd` / `Dif`).

Durante a mão: dica **“Você tem …”** (só suas cartas). Chat = FAB 💬 + emojis (rate-limit Redis).

## Campeões (`/campeoes`)

Ranking persistido no Redis (ou memória local):

- **Fichas** — total ganho em potes
- **Mãos** — mãos vencidas
- **Mesas** — vezes que ficou por último

Link na home e na barra de auth. API: `GET /api/stats`.

## Admin

Área `/admin` (link **Admin** só aparece na barra se o e-mail da sessão estiver na allowlist).

- Gate no **middleware** + `layout` server-side (não-admin → redirect `/` ou 403 na API).
- Lista salas ativas, códigos, jogadores, status; **fechar sala**; **expulsar** jogador (fora de mão).
- Default allowlist: `goncalvesvg1999@gmail.com`. Override com `ADMIN_EMAILS`.

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
| `POST` | `/api/rooms/:code/bots` | Anfitrião: `{ action: "add" }` ou `{ action: "remove", botId }` |
| `POST` | `/api/rooms/:code/settings` | Anfitrião: timer, blinds, `blindSchedule`, auto-mão |
| `POST` | `/api/rooms/:code/chat` | Mensagem / emoji |
| `GET` | `/api/stats` | Rankings (fichas / mãos / mesas) |
| `GET` | `/api/rooms/active` | Mesas ativas (lobby) |
| `POST` | `/api/rooms/:code/leave` | Sair da mesa (fold se mid-hand) |
| `GET/PUT` | `/api/profile` | Apelido / emoji / ficha / feltro |
| `GET` | `/api/admin/rooms` | Lista salas (admin) |
| `DELETE` | `/api/admin/rooms/:code` | Fecha/apaga sala (admin) |
| `POST` | `/api/admin/rooms/:code` | `{ action: "kick", playerId }` (admin) |

## Limitações do MVP

- Auth só Google (JWT); sem adapter de banco para usuários.
- Sem side pots complexos; pot único.
- Polling ~1–2s.
- Memory store não escala em multi-instância — use Upstash em produção.
