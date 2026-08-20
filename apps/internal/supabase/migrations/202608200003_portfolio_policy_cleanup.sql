drop policy if exists "active users can read investment cash flows"
on public.investment_cash_flows;

drop policy if exists "active users can read investment valuation marks"
on public.investment_valuation_marks;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
