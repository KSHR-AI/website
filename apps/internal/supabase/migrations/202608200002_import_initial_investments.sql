do $$
declare
  source_workbook constant text := '1CiGr83r0xJ4KuRCOhrt89X5awr_zCRkZ';
  source_record record;
  company_uuid uuid;
  round_uuid uuid;
  investment_uuid uuid;
begin
  for source_record in
    select *
    from (values
      (2,  'Tanda',     date '2023-07-28', 'SAFE',   1500.00::numeric,   'Seed',      25000000.00::numeric, 0.00600000::numeric,  25000000.00::numeric,   1500.00::numeric),
      (3,  'Pillar',    date '2024-12-09', 'SAFE',   1000.00::numeric,   'Seed',      12000000.00::numeric, 0.00833333::numeric,  75000000.00::numeric,   6250.00::numeric),
      (4,  'Climatix',  date '2024-08-26', 'SAFE',   1000.00::numeric,   'Seed',      25000000.00::numeric, 0.00400000::numeric, 450000000.00::numeric,  18000.00::numeric),
      (5,  'TLDC',      date '2025-06-10', 'SAFE',   1000.00::numeric,   'Seed',      25000000.00::numeric, 0.00400000::numeric,  25000000.00::numeric,   1000.00::numeric),
      (6,  'Zero Labs', date '2025-08-14', 'SAFE',   2000.00::numeric,   'Seed',      18000000.00::numeric, 0.01111111::numeric,  18000000.00::numeric,   2000.00::numeric),
      (7,  'Flint K12', date '2025-10-02', 'Equity', 1000.00::numeric,   'Series A',  56000000.00::numeric, 0.00178571::numeric,  56000000.00::numeric,   1000.00::numeric),
      (8,  'Solvea',    date '2025-10-02', 'SAFE',   1000.00::numeric,   'Seed',      20000000.00::numeric, 0.00500000::numeric,  20000000.00::numeric,   1000.00::numeric),
      (9,  'Argos',     date '2025-10-30', 'SAFE',   1000.00::numeric,   'Seed',      15000000.00::numeric, 0.00666667::numeric,  15000000.00::numeric,   1000.00::numeric),
      (10, 'Anthropic', date '2026-01-26', 'Equity', 100000.00::numeric, 'Series C+', 350000000.00::numeric, 0.02857143::numeric, 965000000.00::numeric, 275714.29::numeric),
      (11, 'Zellic',    date '2026-03-12', 'SAFE',   1000.00::numeric,   'Seed',      35000000.00::numeric, 0.00285714::numeric,  35000000.00::numeric,   1000.00::numeric)
    ) as imported(
      source_row,
      company_name,
      invested_on,
      security,
      amount,
      stage,
      original_valuation,
      ownership_percent,
      latest_valuation,
      fair_value
    )
  loop
    select id into company_uuid
    from public.companies
    where lower(name) = lower(source_record.company_name)
    order by created_at
    limit 1;

    if company_uuid is null then
      insert into public.companies (name, stage, metadata)
      values (
        source_record.company_name,
        'portfolio',
        jsonb_build_object('source_workbook_id', source_workbook)
      )
      returning id into company_uuid;
    end if;

    select id into round_uuid
    from public.rounds
    where company_id = company_uuid
      and (
        metadata @> jsonb_build_object('source_workbook_id', source_workbook, 'source_row', source_record.source_row)
        or (name = source_record.stage and post_money_valuation = source_record.original_valuation)
      )
    order by created_at
    limit 1;

    if round_uuid is null then
      insert into public.rounds (
        company_id,
        name,
        round_type,
        announced_on,
        post_money_valuation,
        metadata
      )
      values (
        company_uuid,
        source_record.stage,
        source_record.stage,
        source_record.invested_on,
        source_record.original_valuation,
        jsonb_build_object('source_workbook_id', source_workbook, 'source_row', source_record.source_row)
      )
      returning id into round_uuid;
    end if;

    select id into investment_uuid
    from public.investments
    where company_id = company_uuid
      and (
        metadata @> jsonb_build_object('source_workbook_id', source_workbook, 'source_row', source_record.source_row)
        or (
          invested_on = source_record.invested_on
          and amount = source_record.amount
          and lower(coalesce(security, '')) = lower(source_record.security)
        )
      )
    order by created_at
    limit 1;

    if investment_uuid is null then
      insert into public.investments (
        company_id,
        round_id,
        invested_on,
        amount,
        ownership_percent,
        security,
        status,
        metadata
      )
      values (
        company_uuid,
        round_uuid,
        source_record.invested_on,
        source_record.amount,
        source_record.ownership_percent,
        source_record.security,
        'active',
        jsonb_build_object('source_workbook_id', source_workbook, 'source_row', source_record.source_row)
      )
      returning id into investment_uuid;
    else
      update public.investments
      set metadata = metadata || jsonb_build_object(
        'source_workbook_id', source_workbook,
        'source_row', source_record.source_row
      )
      where id = investment_uuid;
    end if;

    insert into public.investment_valuation_marks (
      investment_id,
      valued_on,
      fair_value,
      company_valuation,
      source,
      notes,
      metadata
    )
    values (
      investment_uuid,
      date '2026-08-20',
      source_record.fair_value,
      source_record.latest_valuation,
      'Mayank''s Private Startup Investments Tracker - Minimal IRR.xlsm',
      'Initial mark imported from the investment tracker workbook.',
      jsonb_build_object('source_workbook_id', source_workbook, 'source_row', source_record.source_row)
    )
    on conflict (investment_id, valued_on)
    do update set
      fair_value = excluded.fair_value,
      company_valuation = excluded.company_valuation,
      source = excluded.source,
      notes = excluded.notes,
      metadata = public.investment_valuation_marks.metadata || excluded.metadata;

    company_uuid := null;
    round_uuid := null;
    investment_uuid := null;
  end loop;
end;
$$;
