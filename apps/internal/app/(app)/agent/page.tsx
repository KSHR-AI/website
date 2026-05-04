import Link from "next/link";

import { createTask } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { formatDate, toDateTimeInputValue } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

type Company = {
  id: string;
  name: string;
  stage: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Interaction = {
  company_id: string | null;
  occurred_at: string | null;
};

type Task = {
  id: string;
  title: string;
  entity_id: string | null;
  due_at: string | null;
  status: string;
};

type CompanyContact = {
  company_id: string;
};

type Note = {
  entity_id: string;
  created_at: string | null;
};

type Investment = {
  company_id: string;
};

type Metric = {
  company_id: string;
  measured_on: string | null;
};

type Signal = {
  company: Company;
  priority: number;
  label: string;
  reason: string;
  taskTitle: string;
  dueAt: string;
};

const dayMs = 24 * 60 * 60 * 1000;

function daysSince(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - new Date(value).getTime()) / dayMs);
}

function maxDate(existing: string | null | undefined, next: string | null | undefined) {
  if (!existing) {
    return next ?? null;
  }

  if (!next) {
    return existing;
  }

  return new Date(next).getTime() > new Date(existing).getTime() ? next : existing;
}

function dueDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * dayMs).toISOString();
}

export default async function AgentPage() {
  const { supabase } = await requireActiveUser();

  const [companiesResult, interactionsResult, tasksResult, contactsResult, notesResult, investmentsResult, metricsResult] =
    await Promise.all([
      supabase.from("companies").select("id,name,stage,description,created_at,updated_at").order("updated_at", { ascending: false }),
      supabase.from("interactions").select("company_id,occurred_at").order("occurred_at", { ascending: false }),
      supabase.from("tasks").select("id,title,entity_id,due_at,status").eq("status", "open"),
      supabase.from("company_contacts").select("company_id"),
      supabase.from("notes").select("entity_id,created_at").eq("entity_type", "company"),
      supabase.from("investments").select("company_id"),
      supabase.from("portfolio_metrics").select("company_id,measured_on")
    ]);

  const companies = (companiesResult.data ?? []) as Company[];
  const interactions = (interactionsResult.data ?? []) as Interaction[];
  const openTasks = (tasksResult.data ?? []) as Task[];
  const contacts = (contactsResult.data ?? []) as CompanyContact[];
  const notes = (notesResult.data ?? []) as Note[];
  const investments = (investmentsResult.data ?? []) as Investment[];
  const metrics = (metricsResult.data ?? []) as Metric[];

  const lastInteractionByCompany = new Map<string, string | null>();
  const lastNoteByCompany = new Map<string, string | null>();
  const lastMetricByCompany = new Map<string, string | null>();
  const openTasksByCompany = new Map<string, Task[]>();
  const companiesWithContacts = new Set(contacts.map((contact) => contact.company_id));
  const companiesWithInvestments = new Set(investments.map((investment) => investment.company_id));

  interactions.forEach((interaction) => {
    if (interaction.company_id) {
      lastInteractionByCompany.set(
        interaction.company_id,
        maxDate(lastInteractionByCompany.get(interaction.company_id), interaction.occurred_at)
      );
    }
  });

  notes.forEach((note) => {
    lastNoteByCompany.set(note.entity_id, maxDate(lastNoteByCompany.get(note.entity_id), note.created_at));
  });

  metrics.forEach((metric) => {
    lastMetricByCompany.set(metric.company_id, maxDate(lastMetricByCompany.get(metric.company_id), metric.measured_on));
  });

  openTasks.forEach((task) => {
    if (!task.entity_id) {
      return;
    }

    const current = openTasksByCompany.get(task.entity_id) ?? [];
    current.push(task);
    openTasksByCompany.set(task.entity_id, current);
  });

  const signals = companies
    .flatMap((company): Signal[] => {
      const items: Signal[] = [];
      const lastInteraction = lastInteractionByCompany.get(company.id);
      const lastNote = lastNoteByCompany.get(company.id);
      const lastMetric = lastMetricByCompany.get(company.id);
      const tasksForCompany = openTasksByCompany.get(company.id) ?? [];
      const staleDays = daysSince(lastInteraction);

      if (!companiesWithContacts.has(company.id)) {
        items.push({
          company,
          priority: 95,
          label: "Missing founder contact",
          reason: "No linked contact is recorded.",
          taskTitle: `Add founder contact for ${company.name}`,
          dueAt: dueDate(1)
        });
      }

      if (["prospect", "diligence"].includes(company.stage) && staleDays > 14 && tasksForCompany.length === 0) {
        items.push({
          company,
          priority: company.stage === "diligence" ? 90 : 75,
          label: "Follow-up due",
          reason: lastInteraction ? `Last touch was ${formatDate(lastInteraction)}.` : "No interaction has been logged.",
          taskTitle: `Follow up with ${company.name}`,
          dueAt: dueDate(company.stage === "diligence" ? 1 : 3)
        });
      }

      if (company.stage === "diligence" && daysSince(lastNote) > 7) {
        items.push({
          company,
          priority: 80,
          label: "Diligence note stale",
          reason: lastNote ? `Last note was ${formatDate(lastNote)}.` : "No diligence note is recorded.",
          taskTitle: `Update diligence notes for ${company.name}`,
          dueAt: dueDate(2)
        });
      }

      if (company.stage === "portfolio" && !companiesWithInvestments.has(company.id)) {
        items.push({
          company,
          priority: 85,
          label: "Investment record missing",
          reason: "Portfolio company has no linked investment record.",
          taskTitle: `Add investment record for ${company.name}`,
          dueAt: dueDate(2)
        });
      }

      if (company.stage === "portfolio" && daysSince(lastMetric) > 45) {
        items.push({
          company,
          priority: 70,
          label: "Metric update due",
          reason: lastMetric ? `Last metric was ${formatDate(lastMetric)}.` : "No portfolio metric is recorded.",
          taskTitle: `Update portfolio metrics for ${company.name}`,
          dueAt: dueDate(5)
        });
      }

      return items;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);

  const relationshipCoverage = companies.length
    ? Math.round((companies.filter((company) => companiesWithContacts.has(company.id)).length / companies.length) * 100)
    : 0;
  const staleCompanies = companies.filter((company) => daysSince(lastInteractionByCompany.get(company.id)) > 14).length;
  const diligenceCompanies = companies.filter((company) => company.stage === "diligence").length;
  const portfolioMetricGaps = companies.filter(
    (company) => company.stage === "portfolio" && daysSince(lastMetricByCompany.get(company.id)) > 45
  ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Relationship agent</p>
          <h1>Founder tracking</h1>
          <p>Signals, gaps, and follow-ups across prospects, diligence, and portfolio companies.</p>
        </div>
      </header>

      <section className="grid four">
        <article className="panel stat">
          <span className="record-meta">Relationship coverage</span>
          <strong>{relationshipCoverage}%</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Stale touchpoints</span>
          <strong>{staleCompanies}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Active diligence</span>
          <strong>{diligenceCompanies}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Metric gaps</span>
          <strong>{portfolioMetricGaps}</strong>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Action queue</h2>
        <div className="record-list">
          {signals.length ? (
            signals.map((signal) => (
              <div className="record-item" key={`${signal.company.id}-${signal.label}`}>
                <span className="record-title">
                  {signal.label}: <Link href={`/companies/${signal.company.id}`}>{signal.company.name}</Link>
                </span>
                <span className="record-meta">
                  Priority {signal.priority} · {signal.company.stage} · {signal.reason}
                </span>
                <form action={createTask} className="inline-form">
                  <input name="title" type="hidden" value={signal.taskTitle} />
                  <input name="entity_type" type="hidden" value="company" />
                  <input name="entity_id" type="hidden" value={signal.company.id} />
                  <input name="due_at" type="hidden" value={toDateTimeInputValue(signal.dueAt)} />
                  <button className="button secondary" type="submit">
                    Create task
                  </button>
                </form>
              </div>
            ))
          ) : (
            <EmptyState>No relationship gaps detected.</EmptyState>
          )}
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Open founder follow-ups</h2>
          <div className="record-list">
            {openTasks.length ? (
              openTasks.slice(0, 8).map((task) => (
                <div className="record-item" key={task.id}>
                  <span className="record-title">{task.title}</span>
                  <span className="record-meta">Due {formatDate(task.due_at)}</span>
                </div>
              ))
            ) : (
              <EmptyState>No open follow-ups.</EmptyState>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Diligence watchlist</h2>
          <div className="record-list">
            {companies
              .filter((company) => company.stage === "diligence")
              .slice(0, 8)
              .map((company) => (
                <Link className="record-item" href={`/companies/${company.id}`} key={company.id}>
                  <span className="record-title">{company.name}</span>
                  <span className="record-meta">
                    Last touch {formatDate(lastInteractionByCompany.get(company.id))} · Last note{" "}
                    {formatDate(lastNoteByCompany.get(company.id))}
                  </span>
                </Link>
              ))}
          </div>
        </article>
      </section>
    </>
  );
}
