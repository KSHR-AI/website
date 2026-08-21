import { completeTask, createTask, updateTask } from "@/app/(app)/actions";
import { formatDate, toDateTimeInputValue } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function TasksPage() {
  const { supabase } = await requireActiveUser();
  const [tasksResult, companiesResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,due_at,entity_type,entity_id")
      .order("due_at", { ascending: true }),
    supabase.from("companies").select("id,name").order("name"),
  ]);

  const tasks = tasksResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const companyNames = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Follow-ups</p>
          <h1>Tasks</h1>
          <p>Reminders and next steps across the workspace.</p>
        </div>
      </header>

      <section className="sheet-toolbar">
        <div className="toolbar-actions">
          <details className="action-panel">
            <summary>New task</summary>
            <div className="action-panel-body">
              <form action={createTask} className="form-stack">
                <label>
                  Title
                  <input name="title" required />
                </label>
                <div className="form-grid">
                  <label>
                    Related company
                    <select name="entity_id">
                      <option value="">None</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due
                    <input name="due_at" type="datetime-local" />
                  </label>
                </div>
                <input name="entity_type" type="hidden" value="company" />
                <button type="submit">Create task</button>
              </form>
            </div>
          </details>
          <span className="record-meta">{tasks.length} rows</span>
        </div>
      </section>

      <section className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
              <th>Company</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td className="record-title">{task.title}</td>
                <td>
                  <span className="pill">{task.status}</span>
                </td>
                <td>
                  {task.entity_id
                    ? (companyNames.get(task.entity_id) ?? "Unknown")
                    : "—"}
                </td>
                <td>{formatDate(task.due_at)}</td>
                <td>
                  <div className="inline-form">
                    <details className="row-editor">
                      <summary>Edit</summary>
                      <form action={updateTask} className="form-stack">
                        <input name="id" type="hidden" value={task.id} />
                        <input
                          name="entity_type"
                          type="hidden"
                          value="company"
                        />
                        <label>
                          Title
                          <input
                            name="title"
                            defaultValue={task.title}
                            required
                          />
                        </label>
                        <div className="form-grid">
                          <label>
                            Status
                            <select name="status" defaultValue={task.status}>
                              <option value="open">open</option>
                              <option value="done">done</option>
                              <option value="archived">archived</option>
                            </select>
                          </label>
                          <label>
                            Related company
                            <select
                              name="entity_id"
                              defaultValue={task.entity_id ?? ""}
                            >
                              <option value="">None</option>
                              {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Due
                            <input
                              name="due_at"
                              type="datetime-local"
                              defaultValue={toDateTimeInputValue(task.due_at)}
                            />
                          </label>
                        </div>
                        <button type="submit">Save task</button>
                      </form>
                    </details>
                    {task.status === "open" ? (
                      <form action={completeTask}>
                        <input name="id" type="hidden" value={task.id} />
                        <button
                          className="button secondary compact"
                          type="submit"
                        >
                          Done
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5}>No tasks yet. Add one from the toolbar.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
