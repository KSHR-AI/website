import Link from "next/link";

import { createFund, createInvestment, createRound } from "@/app/(app)/actions";
import { formatDate, formatMoney, oneRelation } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

export default async function PortfolioPage() {
  const { supabase } = await requireActiveUser();

  const [companiesResult, fundsResult, roundsResult, investmentsResult] = await Promise.all([
    supabase.from("companies").select("id,name,stage").order("name"),
    supabase.from("funds").select("id,name,vintage_year,description").order("created_at", { ascending: false }),
    supabase.from("rounds").select("id,name,round_type,amount_raised,currency,companies(name)").order("created_at", { ascending: false }),
    supabase.from("investments").select("id,amount,currency,ownership_percent,status,invested_on,companies(id,name),funds(name),rounds(name)").order("created_at", { ascending: false })
  ]);

  const companies = companiesResult.data ?? [];
  const funds = fundsResult.data ?? [];
  const rounds = roundsResult.data ?? [];
  const investments = investmentsResult.data ?? [];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Investments</h1>
          <p>Funds, rounds, investments, ownership, and portfolio tracking.</p>
        </div>
      </header>

      <section className="grid three">
        <article className="panel">
          <h2>Add fund</h2>
          <form action={createFund} className="form-stack">
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Vintage year
              <input name="vintage_year" inputMode="numeric" />
            </label>
            <label>
              Description
              <textarea name="description" />
            </label>
            <button type="submit">Create fund</button>
          </form>
        </article>

        <article className="panel">
          <h2>Add round</h2>
          <form action={createRound} className="form-stack">
            <label>
              Company
              <select name="company_id" required>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Name
                <input name="name" placeholder="Seed, Series A..." required />
              </label>
              <label>
                Type
                <input name="round_type" />
              </label>
              <label>
                Announced
                <input name="announced_on" type="date" />
              </label>
              <label>
                Amount raised
                <input name="amount_raised" inputMode="decimal" />
              </label>
            </div>
            <button type="submit">Create round</button>
          </form>
        </article>

        <article className="panel">
          <h2>Add investment</h2>
          <form action={createInvestment} className="form-stack">
            <label>
              Company
              <select name="company_id" required>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Fund
                <select name="fund_id">
                  <option value="">No fund</option>
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Round
                <select name="round_id">
                  <option value="">No round</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input name="amount" inputMode="decimal" />
              </label>
              <label>
                Ownership %
                <input name="ownership_percent" inputMode="decimal" />
              </label>
              <label>
                Security
                <input name="security" placeholder="SAFE, Preferred..." />
              </label>
              <label>
                Invested on
                <input name="invested_on" type="date" />
              </label>
            </div>
            <button type="submit">Create investment</button>
          </form>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Investment records</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Fund</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((investment) => {
                const company = oneRelation(investment.companies);
                const fund = oneRelation(investment.funds);

                return (
                  <tr key={investment.id}>
                    <td>{company?.id ? <Link href={`/companies/${company.id}`}>{company.name}</Link> : "Unknown"}</td>
                    <td>{fund?.name ?? "—"}</td>
                    <td>{formatMoney(investment.amount, investment.currency)}</td>
                    <td>{investment.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <h2>Rounds</h2>
          <div className="record-list">
            {rounds.map((round) => {
              const company = oneRelation(round.companies);

              return (
                <div className="record-item" key={round.id}>
                  <span className="record-title">{round.name}</span>
                  <span className="record-meta">
                    {company?.name ?? "Unknown company"} · {round.round_type ?? "No type"} ·{" "}
                    {formatMoney(round.amount_raised, round.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <h2>Funds</h2>
          <div className="record-list">
            {funds.map((fund) => (
              <div className="record-item" key={fund.id}>
                <span className="record-title">{fund.name}</span>
                <span className="record-meta">
                  Vintage {fund.vintage_year ?? "not set"} · {fund.description ?? "No description"}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Recent investment dates</h2>
          <div className="record-list">
            {investments.map((investment) => {
              const company = oneRelation(investment.companies);

              return (
                <div className="record-item" key={`${investment.id}-date`}>
                  <span className="record-title">{company?.name ?? "Unknown company"}</span>
                  <span className="record-meta">{formatDate(investment.invested_on)}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </>
  );
}
