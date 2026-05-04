import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { formatDate, formatMoney, oneRelation } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { supabase } = await requireActiveUser();

  const [companies, tasks, diligence, investments, activities] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id,title,due_at,status").eq("status", "open").order("due_at", { ascending: true }).limit(6),
    supabase.from("companies").select("id,name,stage").eq("stage", "diligence").order("updated_at", { ascending: false }).limit(6),
    supabase.from("investments").select("id,amount,currency,status,companies(name)").order("created_at", { ascending: false }).limit(6),
    supabase.from("activity_log").select("id,action,created_at,entity_type").order("created_at", { ascending: false }).limit(8)
  ]);

  const activeInvestmentTotal = (investments.data ?? []).reduce((sum, investment) => {
    const amount = typeof investment.amount === "number" ? investment.amount : Number(investment.amount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Internal dashboard</h1>
          <p>CRM activity, open follow-ups, diligence, and recent portfolio records.</p>
        </div>
        <Link className="button" href="/companies">
          Add company
        </Link>
      </header>

      <section className="grid three">
        <article className="panel stat">
          <span className="record-meta">Companies</span>
          <strong>{companies.count ?? 0}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Open tasks</span>
          <strong>{tasks.data?.length ?? 0}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Recent investment amount</span>
          <strong>{formatMoney(activeInvestmentTotal)}</strong>
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
                  <span className="record-meta">Due {formatDate(task.due_at)}</span>
                </div>
              ))
            ) : (
              <EmptyState>No open tasks yet.</EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Active diligence</h2>
          <div className="record-list">
            {(diligence.data ?? []).length ? (
              diligence.data?.map((company) => (
                <Link className="record-item" href={`/companies/${company.id}`} key={company.id}>
                  <span className="record-title">{company.name}</span>
                  <span className="record-meta">{company.stage}</span>
                </Link>
              ))
            ) : (
              <EmptyState>No companies in diligence.</EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Portfolio snapshot</h2>
          <div className="record-list">
            {(investments.data ?? []).length ? (
              investments.data?.map((investment) => {
                const company = oneRelation(investment.companies);

                return (
                  <div className="record-item" key={investment.id}>
                    <span className="record-title">{company?.name ?? "Unknown company"}</span>
                    <span className="record-meta">
                      {formatMoney(investment.amount, investment.currency)} · {investment.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState>No investment records yet.</EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Recent activity</h2>
          <div className="record-list">
            {(activities.data ?? []).length ? (
              activities.data?.map((activity) => (
                <div className="record-item" key={activity.id}>
                  <span className="record-title">{activity.action.replaceAll("_", " ")}</span>
                  <span className="record-meta">
                    {activity.entity_type ?? "record"} · {formatDate(activity.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState>No activity yet.</EmptyState>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
