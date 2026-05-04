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
          <p>People connected to companies, diligence, and portfolio work.</p>
        </div>
      </header>

      <section className="grid two">
        <article className="panel">
          <h2>Add contact</h2>
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
        </article>

        <article className="panel">
          <h2>Contact index</h2>
          <div className="record-list">
            {(contacts ?? []).map((contact) => (
              <form action={updateContact} className="record-item form-stack" key={contact.id}>
                <input name="id" type="hidden" value={contact.id} />
                <div className="form-grid">
                  <label>
                    First name
                    <input name="first_name" defaultValue={contact.first_name} required />
                  </label>
                  <label>
                    Last name
                    <input name="last_name" defaultValue={contact.last_name ?? ""} />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" defaultValue={contact.email ?? ""} />
                  </label>
                  <label>
                    Phone
                    <input name="phone" defaultValue={contact.phone ?? ""} />
                  </label>
                  <label>
                    Title
                    <input name="title" defaultValue={contact.title ?? ""} />
                  </label>
                  <label>
                    LinkedIn
                    <input name="linkedin_url" defaultValue={contact.linkedin_url ?? ""} />
                  </label>
                </div>
                <button className="button secondary" type="submit">
                  Save contact
                </button>
              </form>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
