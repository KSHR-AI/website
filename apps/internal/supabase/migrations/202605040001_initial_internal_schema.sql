create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('admin', 'member');
create type public.app_user_status as enum ('active', 'inactive');
create type public.company_stage as enum ('prospect', 'diligence', 'portfolio', 'passed', 'exited');
create type public.task_status as enum ('open', 'done', 'archived');
create type public.interaction_kind as enum ('call', 'email', 'meeting', 'note', 'other');
create type public.investment_status as enum ('active', 'watching', 'passed', 'exited');
create type public.entity_kind as enum ('company', 'contact', 'fund', 'investment', 'round', 'task');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  role public.app_role not null default 'admin',
  status public.app_user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  stage public.company_stage not null default 'prospect',
  description text,
  founded_year integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email citext,
  phone text,
  title text,
  linkedin_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_contacts (
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (company_id, contact_id)
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  kind public.interaction_kind not null default 'note',
  occurred_at timestamptz not null default now(),
  summary text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interactions_has_entity check (company_id is not null or contact_id is not null)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_kind not null,
  entity_id uuid not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status public.task_status not null default 'open',
  due_at timestamptz,
  entity_type public.entity_kind,
  entity_id uuid,
  owner_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz not null default now()
);

create table public.entity_tags (
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_type public.entity_kind not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tag_id, entity_type, entity_id)
);

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vintage_year integer,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  round_type text,
  announced_on date,
  amount_raised numeric(18, 2),
  pre_money_valuation numeric(18, 2),
  post_money_valuation numeric(18, 2),
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fund_id uuid references public.funds(id) on delete set null,
  round_id uuid references public.rounds(id) on delete set null,
  invested_on date,
  amount numeric(18, 2),
  currency text not null default 'USD',
  ownership_percent numeric(8, 4),
  security text,
  status public.investment_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_name text not null,
  metric_value numeric(18, 4),
  metric_text text,
  measured_on date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete cascade,
  title text not null,
  storage_path text not null,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_has_parent check (company_id is not null or investment_id is not null)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type public.entity_kind,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index companies_stage_idx on public.companies(stage);
create index companies_name_idx on public.companies(lower(name));
create index contacts_email_idx on public.contacts(email);
create index interactions_company_idx on public.interactions(company_id, occurred_at desc);
create index notes_entity_idx on public.notes(entity_type, entity_id, created_at desc);
create index tasks_status_due_idx on public.tasks(status, due_at);
create index rounds_company_idx on public.rounds(company_id);
create index investments_company_idx on public.investments(company_id);
create index portfolio_metrics_company_idx on public.portfolio_metrics(company_id, measured_on desc);
create index activity_log_recent_idx on public.activity_log(created_at desc);

create trigger app_users_set_updated_at before update on public.app_users for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger interactions_set_updated_at before update on public.interactions for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger funds_set_updated_at before update on public.funds for each row execute function public.set_updated_at();
create trigger rounds_set_updated_at before update on public.rounds for each row execute function public.set_updated_at();
create trigger investments_set_updated_at before update on public.investments for each row execute function public.set_updated_at();
create trigger portfolio_metrics_set_updated_at before update on public.portfolio_metrics for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();

create or replace function public.current_app_user_is_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.app_users
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.current_app_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.app_users
    where id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

alter table public.app_users enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.company_contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;
alter table public.funds enable row level security;
alter table public.rounds enable row level security;
alter table public.investments enable row level security;
alter table public.portfolio_metrics enable row level security;
alter table public.documents enable row level security;
alter table public.activity_log enable row level security;

create policy "app users can read themselves or admins can read all"
on public.app_users for select
to authenticated
using (id = auth.uid() or public.current_app_user_is_admin());

create policy "admins can manage app users"
on public.app_users for all
to authenticated
using (public.current_app_user_is_admin())
with check (public.current_app_user_is_admin());

create policy "active users can read companies" on public.companies for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write companies" on public.companies for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read contacts" on public.contacts for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write contacts" on public.contacts for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read company contacts" on public.company_contacts for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write company contacts" on public.company_contacts for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read interactions" on public.interactions for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write interactions" on public.interactions for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read notes" on public.notes for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write notes" on public.notes for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read tasks" on public.tasks for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write tasks" on public.tasks for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read tags" on public.tags for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write tags" on public.tags for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read entity tags" on public.entity_tags for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write entity tags" on public.entity_tags for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read funds" on public.funds for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write funds" on public.funds for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read rounds" on public.rounds for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write rounds" on public.rounds for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read investments" on public.investments for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write investments" on public.investments for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read portfolio metrics" on public.portfolio_metrics for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write portfolio metrics" on public.portfolio_metrics for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read documents" on public.documents for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write documents" on public.documents for all to authenticated using (public.current_app_user_is_active()) with check (public.current_app_user_is_active());
create policy "active users can read activity" on public.activity_log for select to authenticated using (public.current_app_user_is_active());
create policy "active users can write activity" on public.activity_log for insert to authenticated with check (public.current_app_user_is_active());

insert into storage.buckets (id, name, public)
values ('internal-documents', 'internal-documents', false)
on conflict (id) do nothing;

create policy "active users can read internal documents"
on storage.objects for select
to authenticated
using (bucket_id = 'internal-documents' and public.current_app_user_is_active());

create policy "active users can write internal documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'internal-documents' and public.current_app_user_is_active());

create policy "active users can update internal documents"
on storage.objects for update
to authenticated
using (bucket_id = 'internal-documents' and public.current_app_user_is_active())
with check (bucket_id = 'internal-documents' and public.current_app_user_is_active());
