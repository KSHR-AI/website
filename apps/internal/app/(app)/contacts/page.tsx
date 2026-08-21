import { createContact, updateContact } from "@/app/(app)/actions";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function ContactsPage() {
  const { supabase } = await requireActiveUser();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id,first_name,last_name,email,phone,title,linkedin_url,created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Relationships</p>
          <h1>Contacts</h1>
          <p>People connected to diligence and portfolio work.</p>
        </div>
      </header>

      <section className="sheet-toolbar">
        <div className="toolbar-actions">
          <details className="action-panel">
            <summary>New contact</summary>
            <div className="action-panel-body">
              <form action={createContact} className="form-stack">
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
                    Phone
                    <input name="phone" />
                  </label>
                  <label>
                    Title
                    <input name="title" />
                  </label>
                  <label>
                    LinkedIn
                    <input name="linkedin_url" />
                  </label>
                </div>
                <button type="submit">Create contact</button>
              </form>
            </div>
          </details>
          <span className="record-meta">{contacts?.length ?? 0} rows</span>
        </div>
      </section>

      <section className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Email</th>
              <th>Phone</th>
              <th>LinkedIn</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((contact) => (
              <tr key={contact.id}>
                <td className="record-title">
                  {contact.first_name} {contact.last_name}
                </td>
                <td>{contact.title ?? "—"}</td>
                <td>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{contact.phone ?? "—"}</td>
                <td>
                  {contact.linkedin_url ? (
                    <a
                      href={contact.linkedin_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open profile
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <details className="row-editor">
                    <summary>Edit</summary>
                    <form action={updateContact} className="form-stack">
                      <input name="id" type="hidden" value={contact.id} />
                      <div className="form-grid">
                        <label>
                          First name
                          <input
                            name="first_name"
                            defaultValue={contact.first_name}
                            required
                          />
                        </label>
                        <label>
                          Last name
                          <input
                            name="last_name"
                            defaultValue={contact.last_name ?? ""}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={contact.email ?? ""}
                          />
                        </label>
                        <label>
                          Phone
                          <input
                            name="phone"
                            defaultValue={contact.phone ?? ""}
                          />
                        </label>
                        <label>
                          Title
                          <input
                            name="title"
                            defaultValue={contact.title ?? ""}
                          />
                        </label>
                        <label>
                          LinkedIn
                          <input
                            name="linkedin_url"
                            defaultValue={contact.linkedin_url ?? ""}
                          />
                        </label>
                      </div>
                      <button type="submit">Save contact</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {(contacts ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}>
                  Add the first contact to start the relationship index.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
