import Link from "next/link";

import { createCompany } from "@/app/(app)/actions";
import { requireActiveUser } from "@/lib/supabase/server";

type CompaniesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const stages = ["prospect", "diligence", "portfolio", "passed", "exited"];

export default async function CompaniesPage({
  searchParams,
}: CompaniesPageProps) {
  const { supabase } = await requireActiveUser();
  const params = await searchParams;
  const stage = typeof params.stage === "string" ? params.stage : "";
  const error = typeof params.error === "string" ? params.error : "";

  let query = supabase
    .from("companies")
    .select("id,name,website,stage,description,updated_at")
    .order("updated_at", { ascending: false });

  if (stage) {
    query = query.eq("stage", stage);
  }

  const { data: companies } = await query;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>Companies</h1>
          <p>
            One index for pipeline, diligence, portfolio companies, and passes.
          </p>
        </div>
      </header>

      {error ? (
        <p className="alert">
          The company could not be saved. Check the required fields.
        </p>
      ) : null}

      <section className="sheet-toolbar">
        <div className="toolbar-actions">
          <details className="action-panel" id="add-company">
            <summary>New company</summary>
            <div className="action-panel-body">
              <form action={createCompany} className="form-stack">
                <div className="form-grid">
                  <label>
                    Name
                    <input name="name" required />
                  </label>
                  <label>
                    Website
                    <input name="website" placeholder="https://example.com" />
                  </label>
                  <label>
                    Stage
                    <select name="stage" defaultValue="prospect">
                      {stages.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Founded year
                    <input name="founded_year" inputMode="numeric" />
                  </label>
                </div>
                <label>
                  Description
                  <textarea name="description" />
                </label>
                <button type="submit">Create company</button>
              </form>
            </div>
          </details>
          <span className="record-meta">{companies?.length ?? 0} rows</span>
        </div>
        <form className="inline-filter">
          <label>
            Stage
            <select name="stage" defaultValue={stage}>
              <option value="">All stages</option>
              {stages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary compact" type="submit">
            Apply
          </button>
        </form>
      </section>

      <section className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stage</th>
              <th>Website</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {(companies ?? []).map((company) => (
              <tr key={company.id}>
                <td>
                  <Link href={`/companies/${company.id}`}>{company.name}</Link>
                </td>
                <td>
                  <span className="pill">{company.stage}</span>
                </td>
                <td>
                  {company.website ? (
                    <a href={company.website} rel="noreferrer" target="_blank">
                      {company.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{company.description ?? "—"}</td>
              </tr>
            ))}
            {(companies ?? []).length === 0 ? (
              <tr>
                <td colSpan={4}>No companies match this stage.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
