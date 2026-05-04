import { notFound } from "next/navigation";

import {
  createCompanyContact,
  createDocumentRecord,
  createInteraction,
  createMetric,
  createNote,
  createTask,
  updateInteraction,
  updateNote,
  updateTask,
  updateCompany
} from "@/app/(app)/actions";
import { formatDate, formatMoney, oneRelation, toDateTimeInputValue } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

type CompanyPageProps = {
  params: Promise<{ id: string }>;
};

const stages = ["prospect", "diligence", "portfolio", "passed", "exited"];

export default async function CompanyDetailPage({ params }: CompanyPageProps) {
  const { id } = await params;
  const { supabase } = await requireActiveUser();

  const [
    companyResult,
    contactsResult,
    notesResult,
    tasksResult,
    interactionsResult,
    investmentsResult,
    metricsResult,
    documentsResult
  ] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).single(),
    supabase.from("company_contacts").select("relationship,is_primary,contacts(id,first_name,last_name,email,title)").eq("company_id", id),
    supabase.from("notes").select("id,body,created_at").eq("entity_type", "company").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("id,title,status,due_at").eq("entity_type", "company").eq("entity_id", id).order("due_at", { ascending: true }),
    supabase.from("interactions").select("id,kind,summary,notes,occurred_at").eq("company_id", id).order("occurred_at", { ascending: false }),
    supabase.from("investments").select("id,amount,currency,status,invested_on,funds(name),rounds(name)").eq("company_id", id),
    supabase.from("portfolio_metrics").select("id,metric_name,metric_value,metric_text,measured_on").eq("company_id", id).order("measured_on", { ascending: false }),
    supabase.from("documents").select("id,title,storage_path,mime_type,created_at").eq("company_id", id).order("created_at", { ascending: false })
  ]);

  if (companyResult.error || !companyResult.data) {
    notFound();
  }

  const company = companyResult.data;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Company</p>
          <h1>{company.name}</h1>
          <p>{company.description ?? "No description yet."}</p>
        </div>
        <span className="pill">{company.stage}</span>
      </header>

      <section className="grid two">
        <article className="panel">
          <h2>Edit company</h2>
          <form action={updateCompany} className="form-stack">
            <input name="id" type="hidden" value={company.id} />
            <div className="form-grid">
              <label>
                Name
                <input name="name" defaultValue={company.name} required />
              </label>
              <label>
                Website
                <input name="website" defaultValue={company.website ?? ""} />
              </label>
              <label>
                Stage
                <select name="stage" defaultValue={company.stage}>
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Founded year
                <input name="founded_year" defaultValue={company.founded_year ?? ""} />
              </label>
            </div>
            <label>
              Description
              <textarea name="description" defaultValue={company.description ?? ""} />
            </label>
            <button type="submit">Save company</button>
          </form>
        </article>

        <article className="panel">
          <h2>Add contact</h2>
          <form action={createCompanyContact} className="form-stack">
            <input name="company_id" type="hidden" value={company.id} />
            <div className="form-grid">
              <label>
                First name
                <input name="first_name" required />
              </label>
              <label>
                Last name
                <input name="last_name" />
              </label>
              <label>
                Email
                <input name="email" type="email" />
              </label>
              <label>
                Title
                <input name="title" />
              </label>
            </div>
            <label>
              Relationship
              <input name="relationship" placeholder="Founder, CFO, investor..." />
            </label>
            <button type="submit">Add and link contact</button>
          </form>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Contacts</h2>
          <div className="record-list">
            {(contactsResult.data ?? []).map((row) => {
              const contact = oneRelation(row.contacts);

              return (
                <div className="record-item" key={contact?.id ?? row.relationship}>
                  <span className="record-title">
                    {contact?.first_name} {contact?.last_name}
                  </span>
                  <span className="record-meta">
                    {contact?.title ?? "No title"} · {contact?.email ?? "No email"} · {row.relationship ?? "No relationship"}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <h2>Add interaction</h2>
          <form action={createInteraction} className="form-stack">
            <input name="company_id" type="hidden" value={company.id} />
            <div className="form-grid">
              <label>
                Kind
                <select name="kind" defaultValue="meeting">
                  <option value="meeting">meeting</option>
                  <option value="call">call</option>
                  <option value="email">email</option>
                  <option value="note">note</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label>
                Occurred at
                <input name="occurred_at" type="datetime-local" />
              </label>
            </div>
            <label>
              Summary
              <input name="summary" required />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <button type="submit">Add interaction</button>
          </form>
        </article>

        <article className="panel">
          <h2>Notes</h2>
          <form action={createNote} className="form-stack">
            <input name="entity_type" type="hidden" value="company" />
            <input name="entity_id" type="hidden" value={company.id} />
            <textarea name="body" placeholder="Add a note..." required />
            <button type="submit">Add note</button>
          </form>
          <div className="record-list" style={{ marginTop: 16 }}>
            {(notesResult.data ?? []).map((note) => (
              <form action={updateNote} className="record-item form-stack" key={note.id}>
                <input name="id" type="hidden" value={note.id} />
                <input name="entity_type" type="hidden" value="company" />
                <input name="entity_id" type="hidden" value={company.id} />
                <textarea name="body" defaultValue={note.body} required />
                <span className="record-meta">{formatDate(note.created_at)}</span>
                <button className="button secondary" type="submit">
                  Save note
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Tasks</h2>
          <form action={createTask} className="form-stack">
            <input name="entity_type" type="hidden" value="company" />
            <input name="entity_id" type="hidden" value={company.id} />
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Due
              <input name="due_at" type="datetime-local" />
            </label>
            <button type="submit">Add task</button>
          </form>
          <div className="record-list" style={{ marginTop: 16 }}>
            {(tasksResult.data ?? []).map((task) => (
              <form action={updateTask} className="record-item form-stack" key={task.id}>
                <input name="id" type="hidden" value={task.id} />
                <input name="entity_type" type="hidden" value="company" />
                <input name="entity_id" type="hidden" value={company.id} />
                <div className="form-grid">
                  <label>
                    Title
                    <input name="title" defaultValue={task.title} required />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={task.status}>
                      <option value="open">open</option>
                      <option value="done">done</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                  <label>
                    Due
                    <input name="due_at" type="datetime-local" defaultValue={toDateTimeInputValue(task.due_at)} />
                  </label>
                </div>
                <button className="button secondary" type="submit">
                  Save task
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Interactions</h2>
          <div className="record-list">
            {(interactionsResult.data ?? []).map((interaction) => (
              <form action={updateInteraction} className="record-item form-stack" key={interaction.id}>
                <input name="id" type="hidden" value={interaction.id} />
                <input name="company_id" type="hidden" value={company.id} />
                <div className="form-grid">
                  <label>
                    Kind
                    <select name="kind" defaultValue={interaction.kind}>
                      <option value="meeting">meeting</option>
                      <option value="call">call</option>
                      <option value="email">email</option>
                      <option value="note">note</option>
                      <option value="other">other</option>
                    </select>
                  </label>
                  <label>
                    Occurred at
                    <input
                      name="occurred_at"
                      type="datetime-local"
                      defaultValue={toDateTimeInputValue(interaction.occurred_at)}
                    />
                  </label>
                </div>
                <label>
                  Summary
                  <input name="summary" defaultValue={interaction.summary} required />
                </label>
                <label>
                  Notes
                  <textarea name="notes" defaultValue={interaction.notes ?? ""} />
                </label>
                <button className="button secondary" type="submit">
                  Save interaction
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Investments</h2>
          <div className="record-list">
            {(investmentsResult.data ?? []).map((investment) => {
              const fund = oneRelation(investment.funds);
              const round = oneRelation(investment.rounds);

              return (
                <div className="record-item" key={investment.id}>
                  <span className="record-title">{formatMoney(investment.amount, investment.currency)}</span>
                  <span className="record-meta">
                    {fund?.name ?? "No fund"} · {round?.name ?? "No round"} · {investment.status}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <h2>Add metric</h2>
          <form action={createMetric} className="form-stack">
            <input name="company_id" type="hidden" value={company.id} />
            <div className="form-grid">
              <label>
                Metric
                <input name="metric_name" placeholder="ARR, Revenue, Headcount" required />
              </label>
              <label>
                Date
                <input name="measured_on" type="date" />
              </label>
              <label>
                Numeric value
                <input name="metric_value" inputMode="decimal" />
              </label>
              <label>
                Text value
                <input name="metric_text" />
              </label>
            </div>
            <button type="submit">Add metric</button>
          </form>
          <div className="record-list" style={{ marginTop: 16 }}>
            {(metricsResult.data ?? []).map((metric) => (
              <div className="record-item" key={metric.id}>
                <span className="record-title">{metric.metric_name}</span>
                <span className="record-meta">
                  {metric.metric_text ?? metric.metric_value ?? "No value"} · {formatDate(metric.measured_on)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Documents</h2>
          <form action={createDocumentRecord} className="form-stack">
            <input name="company_id" type="hidden" value={company.id} />
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Storage path
              <input name="storage_path" placeholder="internal-documents/company/file.pdf" required />
            </label>
            <button type="submit">Add document record</button>
          </form>
          <div className="record-list" style={{ marginTop: 16 }}>
            {(documentsResult.data ?? []).map((document) => (
              <div className="record-item" key={document.id}>
                <span className="record-title">{document.title}</span>
                <span className="record-meta">{document.storage_path}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
