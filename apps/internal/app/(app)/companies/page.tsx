import Link from "next/link";

import { createCompany } from "@/app/(app)/actions";
import { requireActiveUser } from "@/lib/supabase/server";

type CompaniesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const stages = ["prospect", "diligence", "portfolio", "passed", "exited"];

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const { supabase } = await requireActiveUser();
  const params = await searchParams;
  const stage = typeof params.stage === "string" ? params.stage : "";

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
          <p>Track prospects, diligence, portfolio companies, and passed opportunities.</p>
        </div>
      </header>

      <section className="grid two">
        <article className="panel">
          <h2>Add company</h2>
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
        </article>

        <article className="panel">
          <h2>Filter</h2>
          <form className="form-stack">
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
            <button type="submit">Apply filter</button>
          </form>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Company index</h2>
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
                <td>{company.website ? <a href={company.website}>{company.website}</a> : "—"}</td>
                <td>{company.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
