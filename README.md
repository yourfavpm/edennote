# EdenNote AI

Enterprise SaaS meeting intelligence engine.

## Tech Stack

- **Frontend**: Next.js (App Router), Tailwind CSS, Vercel
- **API**: Fastify (Node.js), TypeScript, Render
- **Worker**: BullMQ, Redis, AssemblyAI, LLM, Render
- **Infrastructure**: Supabase (Auth, DB, Realtime, Storage)

## Monorepo Structure

- `apps/web`: Frontend dashboard
- `apps/api`: Backend REST API
- `apps/worker`: Background processing jobs
- `packages/shared`: Zod schemas and TypeScript types
- `packages/supabase`: Database migrations and RLS policies

## Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Redis (for BullMQ)
- Supabase Project

### Installation

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` in each app/package and fill in your secrets.

- `apps/api/.env`
- `apps/worker/.env`
- `apps/web/.env`

### Development

```bash
pnpm dev
```

## Deployment

- Web: Vercel
- API & Worker: Render (or similar)
- DB/Auth/Storage: Supabase
