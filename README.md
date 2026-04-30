# MG Work

B2B2C matchmaking platform connecting Mauritian companies with qualified Malagasy candidates.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn-style components · Supabase (PostgreSQL + Storage) · Prisma · Clerk · Anthropic Claude · Vercel · GitHub Actions

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in keys
npm run prisma:generate
npm run dev
```

The dev server runs at <http://localhost:3000>.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier write |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | `prisma migrate dev` (uses `.env.local`) |
| `npm run prisma:studio` | Open Prisma Studio |

## Environment variables

See `.env.example`. `.env.local` is gitignored — never commit real keys.

The Supabase Prisma URLs (`DATABASE_URL`, `DIRECT_URL`) need the database password from
Supabase project settings → Database. The host shown in `.env.example` is the EU pooler;
update if your project sits in a different region.

## Branching

- `main` — production. Deployed to Vercel production.
- `develop` — preview. Deployed to Vercel preview.
- `feature/*` — short-lived branches; PR into `develop`.

## Project docs

- [docs/PROJECT.md](docs/PROJECT.md) — high-level project overview
- [docs/roadmap.md](docs/roadmap.md) — full technical spec (source of truth)
- [docs/tasks/phase-1.md](docs/tasks/phase-1.md) — Phase 1 task list
