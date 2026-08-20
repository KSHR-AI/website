create type public.investment_cash_flow_type as enum ('contribution', 'distribution', 'fee');

alter table public.investments
  alter column ownership_percent type numeric(14, 8);

create table public.investment_cash_flows (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  occurred_on date not null,
  cash_flow_type public.investment_cash_flow_type not null,
  amount numeric(18, 2) not null,
  notes text,
  is_initial_contribution boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_cash_flows_positive_amount check (amount > 0),
  constraint investment_cash_flows_initial_type check (not is_initial_contribution or cash_flow_type = 'contribution')
);

create table public.investment_valuation_marks (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  valued_on date not null,
  fair_value numeric(18, 2) not null,
  company_valuation numeric(18, 2),
  source text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_valuation_marks_nonnegative_fair_value check (fair_value >= 0),
  constraint investment_valuation_marks_nonnegative_company_valuation check (company_valuation is null or company_valuation >= 0),
  constraint investment_valuation_marks_one_per_date unique (investment_id, valued_on)
);

create index investment_cash_flows_investment_date_idx
  on public.investment_cash_flows(investment_id, occurred_on);
create unique index investment_cash_flows_initial_contribution_idx
  on public.investment_cash_flows(investment_id)
  where is_initial_contribution;
create index investment_valuation_marks_investment_date_idx
  on public.investment_valuation_marks(investment_id, valued_on desc);

create trigger investment_cash_flows_set_updated_at
  before update on public.investment_cash_flows
  for each row execute function public.set_updated_at();
create trigger investment_valuation_marks_set_updated_at
  before update on public.investment_valuation_marks
  for each row execute function public.set_updated_at();

alter table public.investment_cash_flows enable row level security;
alter table public.investment_valuation_marks enable row level security;

create policy "active users can read investment cash flows"
on public.investment_cash_flows for select
to authenticated
using ((select public.current_app_user_is_active()));

create policy "active users can write investment cash flows"
on public.investment_cash_flows for all
to authenticated
using ((select public.current_app_user_is_active()))
with check ((select public.current_app_user_is_active()));

create policy "active users can read investment valuation marks"
on public.investment_valuation_marks for select
to authenticated
using ((select public.current_app_user_is_active()));

create policy "active users can write investment valuation marks"
on public.investment_valuation_marks for all
to authenticated
using ((select public.current_app_user_is_active()))
with check ((select public.current_app_user_is_active()));

grant usage on type public.investment_cash_flow_type to authenticated;
grant select, insert, update, delete on public.investment_cash_flows to authenticated;
grant select, insert, update, delete on public.investment_valuation_marks to authenticated;

create or replace function public.sync_investment_initial_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount is null or new.amount <= 0 or new.invested_on is null then
    delete from public.investment_cash_flows
    where investment_id = new.id and is_initial_contribution;
    return new;
  end if;

  insert into public.investment_cash_flows (
    investment_id,
    occurred_on,
    cash_flow_type,
    amount,
    notes,
    is_initial_contribution,
    created_by
  )
  values (
    new.id,
    new.invested_on,
    'contribution',
    new.amount,
    'Initial investment',
    true,
    new.created_by
  )
  on conflict (investment_id) where is_initial_contribution
  do update set
    occurred_on = excluded.occurred_on,
    amount = excluded.amount,
    created_by = excluded.created_by;

  return new;
end;
$$;

revoke all on function public.sync_investment_initial_contribution() from public, anon, authenticated;

create trigger investments_sync_initial_contribution
  after insert or update of amount, invested_on on public.investments
  for each row execute function public.sync_investment_initial_contribution();

insert into public.investment_cash_flows (
  investment_id,
  occurred_on,
  cash_flow_type,
  amount,
  notes,
  is_initial_contribution,
  created_by
)
select
  investment.id,
  investment.invested_on,
  'contribution',
  investment.amount,
  'Initial investment',
  true,
  investment.created_by
from public.investments as investment
where investment.amount > 0
  and investment.invested_on is not null
on conflict (investment_id) where is_initial_contribution do nothing;

create or replace function public.current_app_user_is_active()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.current_app_user_is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and status = 'active'
      and role = 'admin'
  );
$$;

revoke all on function public.current_app_user_is_active() from public, anon;
revoke all on function public.current_app_user_is_admin() from public, anon;
grant execute on function public.current_app_user_is_active() to authenticated;
grant execute on function public.current_app_user_is_admin() to authenticated;
