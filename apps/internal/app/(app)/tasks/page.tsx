import { completeTask, createTask, updateTask } from "@/app/(app)/actions";
import { formatDate, toDateTimeInputValue } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function TasksPage() {
  const { supabase } = await requireActiveUser();
  const [tasksResult, companiesResult] = await Promise.all([
    supabase.from("tasks").select("id,title,status,due_at,entity_type,entity_id").order("due_at", { ascending: true }),
    supabase.from("companies").select("id,name").order("name")
  ]);

  const tasks = tasksResult.data ?? [];
  const companies = companiesResult.data ?? [];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Follow-ups</p>
          <h1>Tasks</h1>
          <p>Open reminders and next steps across CRM and portfolio work.</p>
        </div>
      </header>

      <section className="grid two">
        <article className="panel">
          <h2>Add task</h2>
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
        </article>

        <article className="panel">
          <h2>Task list</h2>
          <div className="record-list">
            {tasks.map((task) => (
              <div className="record-item" key={task.id}>
                <form action={updateTask} className="form-stack">
                  <input name="id" type="hidden" value={task.id} />
                  <input name="entity_type" type="hidden" value="company" />
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
                      Related company
                      <select name="entity_id" defaultValue={task.entity_id ?? ""}>
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
                      <input name="due_at" type="datetime-local" defaultValue={toDateTimeInputValue(task.due_at)} />
                    </label>
                  </div>
                  <span className="record-meta">Current due date: {formatDate(task.due_at)}</span>
                  <button className="button secondary" type="submit">
                    Save task
                  </button>
                </form>
                {task.status === "open" ? (
                  <form action={completeTask}>
                    <input name="id" type="hidden" value={task.id} />
                    <button className="button secondary" type="submit">
                      Mark done
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
