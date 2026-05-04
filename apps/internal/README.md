# KSHR Internal

Internal CRM and portfolio management app for KSHR.

## Local setup

1. Copy `.env.local.example` to `.env.local`.
2. Fill in Supabase values. Keep `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-only.
3. Install dependencies from the repo root with `npm install` after confirming dependency installation.
4. Apply SQL migrations from `supabase/migrations` to the Supabase project after confirming the remote schema change: `npm --workspace @kshr/internal run db:push`.
5. Run `npm run internal:dev`.
6. Run `npm --workspace @kshr/internal run smoke:supabase` to verify Auth, RLS, CRUD, and private document storage. The smoke test reads `apps/internal/.env.local` when present.

## Deployment

Create a Vercel project with root directory `apps/internal`. Keep the public static site at the repo root on GitHub Pages.

## MVP surfaces

- `/login` for Supabase magic-link auth.
- `/` for dashboard totals, tasks, active diligence, portfolio snapshot, and recent activity.
- `/agent` for founder-tracking signals and one-click follow-up tasks.
- `/companies` and `/companies/[id]` for CRM records, contacts, notes, tasks, interactions, investments, metrics, and documents.
- `/contacts`, `/portfolio`, and `/tasks` for relationship, fund, investment, and follow-up workflows.
