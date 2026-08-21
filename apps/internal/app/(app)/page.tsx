import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import {
  formatDate,
  formatMoney,
  formatMultiple,
  formatPercentage,
  oneRelation,
} from "@/lib/format";
import {
  calculatePortfolioMetrics,
  type InvestmentCashFlow,
  type PortfolioInvestment,
} from "@/lib/portfolio";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { supabase } = await requireActiveUser();

  const [tasks, diligence, investments, activities] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,due_at,status")
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(6),
    supabase
      .from("companies")
      .select("id,name,stage")
      .eq("stage", "diligence")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("investments")
      .select(
        "id,amount,currency,status,invested_on,companies(name),investment_cash_flows(amount,cash_flow_type,occurred_on),investment_valuation_marks(fair_value,valued_on)",
      )
      .order("invested_on", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id,action,created_at,entity_type")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const fundMetrics = calculatePortfolioMetrics(
    (investments.data ?? []).map(
      (investment) =>
        ({
          amount: investment.amount,
          cashFlows: investment.investment_cash_flows.map((cashFlow) => ({
            amount: cashFlow.amount,
            cash_flow_type:
              cashFlow.cash_flow_type as InvestmentCashFlow["cash_flow_type"],
            occurred_on: cashFlow.occurred_on,
          })),
          investedOn: investment.invested_on,
          status: investment.status,
          valuations: investment.investment_valuation_marks,
        }) satisfies PortfolioInvestment,
    ),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">KSHR</p>
          <h1>Overview</h1>
          <p>Holdings, returns, diligence, and follow-ups.</p>
        </div>
        <Link className="button compact" href="/portfolio">
          Open fund
        </Link>
      </header>

      <section className="grid four metric-strip metric-strip-four">
        <article className="panel stat">
          <span className="record-meta">Paid in</span>
          <strong>{formatMoney(fundMetrics.paidIn)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Fair value</span>
          <strong>{formatMoney(fundMetrics.currentValue)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">TVPI</span>
          <strong>{formatMultiple(fundMetrics.tvpi)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">IRR</span>
          <strong>{formatPercentage(fundMetrics.xirr)}</strong>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Open tasks</h2>
          <div className="record-list">
            {(tasks.data ?? []).length ? (
              tasks.data?.map((task) => (
                <div className="record-item" key={task.id}>
                  <span className="record-title">{task.title}</span>
                  <span className="record-meta">
                    Due {formatDate(task.due_at)}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState actionHref="/tasks" actionLabel="Add a task">
                Nothing needs follow-up.
              </EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Active diligence</h2>
          <div className="record-list">
            {(diligence.data ?? []).length ? (
              diligence.data?.map((company) => (
                <Link
                  className="record-item"
                  href={`/companies/${company.id}`}
                  key={company.id}
                >
                  <span className="record-title">{company.name}</span>
                  <span className="record-meta">{company.stage}</span>
                </Link>
              ))
            ) : (
              <EmptyState
                actionHref="/companies"
                actionLabel="Review companies"
              >
                No companies are in diligence.
              </EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Portfolio snapshot</h2>
          <div className="record-list">
            {(investments.data ?? []).length ? (
              investments.data?.slice(0, 6).map((investment) => {
                const company = oneRelation(investment.companies);

                return (
                  <div className="record-item" key={investment.id}>
                    <span className="record-title">
                      {company?.name ?? "Unknown company"}
                    </span>
                    <span className="record-meta">
                      {formatMoney(investment.amount, investment.currency)} ·{" "}
                      {investment.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState
                actionHref="/portfolio#portfolio-actions"
                actionLabel="Add a holding"
              >
                No holdings are recorded.
              </EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Recent activity</h2>
          <div className="record-list">
            {(activities.data ?? []).length ? (
              activities.data?.map((activity) => (
                <div className="record-item" key={activity.id}>
                  <span className="record-title">
                    {activity.action.replaceAll("_", " ")}
                  </span>
                  <span className="record-meta">
                    {activity.entity_type ?? "record"} ·{" "}
                    {formatDate(activity.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState>No recent changes.</EmptyState>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
