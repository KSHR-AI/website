import Link from "next/link";

import {
  createFund,
  createInvestment,
  createInvestmentCashFlow,
  createInvestmentValuationMark,
  createRound,
} from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import {
  formatDate,
  formatMoney,
  formatMultiple,
  formatOwnership,
  formatPercentage,
  oneRelation,
} from "@/lib/format";
import {
  calculateInvestmentMetrics,
  calculatePortfolioMetrics,
  type InvestmentCashFlow,
  type PortfolioInvestment,
} from "@/lib/portfolio";
import { requireActiveUser } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type InvestmentRecord = {
  amount: number | string | null;
  companies: Relation<{ id: string; name: string; stage: string }>;
  currency: string;
  funds: Relation<{ name: string }>;
  id: string;
  invested_on: string | null;
  investment_cash_flows: Array<{
    amount: number | string;
    cash_flow_type: string;
    occurred_on: string;
  }>;
  investment_valuation_marks: Array<{
    company_valuation: number | string | null;
    fair_value: number | string;
    valued_on: string;
  }>;
  ownership_percent: number | string | null;
  rounds: Relation<{
    name: string;
    post_money_valuation: number | string | null;
  }>;
  security: string | null;
  status: string;
};

const errorMessages: Record<string, string> = {
  cash_flow_create_failed: "The cash flow could not be saved.",
  cash_flow_required: "Choose an investment, date, type, and positive amount.",
  investment_create_failed: "The investment could not be saved.",
  investment_required:
    "Company, investment date, and a positive amount are required.",
  valuation_mark_create_failed: "The valuation mark could not be saved.",
  valuation_mark_required:
    "Choose an investment, valuation date, and nonnegative fair value.",
};

function portfolioInput(investment: InvestmentRecord): PortfolioInvestment {
  return {
    amount: investment.amount,
    cashFlows: investment.investment_cash_flows.map((cashFlow) => ({
      amount: cashFlow.amount,
      cash_flow_type:
        cashFlow.cash_flow_type as InvestmentCashFlow["cash_flow_type"],
      occurred_on: cashFlow.occurred_on,
    })),
    investedOn: investment.invested_on,
    status: investment.status,
    valuations: investment.investment_valuation_marks,
  };
}

function investmentName(investment: InvestmentRecord) {
  const company = oneRelation(investment.companies);
  return `${company?.name ?? "Unknown company"} · ${formatMoney(investment.amount, investment.currency)}`;
}

function latestMark(investment: InvestmentRecord) {
  return [...investment.investment_valuation_marks].sort(
    (a, b) => new Date(b.valued_on).getTime() - new Date(a.valued_on).getTime(),
  )[0];
}

export default async function PortfolioPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
  const { error } = await searchParams;
  const { supabase } = await requireActiveUser();
  const today = new Date().toISOString().slice(0, 10);

  const [companiesResult, fundsResult, roundsResult, investmentsResult] =
    await Promise.all([
      supabase.from("companies").select("id,name,stage").order("name"),
      supabase
        .from("funds")
        .select("id,name,vintage_year,description")
        .order("created_at", { ascending: false }),
      supabase
        .from("rounds")
        .select(
          "id,name,round_type,amount_raised,currency,post_money_valuation,companies(name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("investments")
        .select(
          "id,amount,currency,ownership_percent,status,security,invested_on,companies(id,name,stage),funds(name),rounds(name,post_money_valuation),investment_cash_flows(amount,cash_flow_type,occurred_on),investment_valuation_marks(fair_value,company_valuation,valued_on)",
        )
        .order("invested_on", { ascending: false }),
    ]);

  const companies = companiesResult.data ?? [];
  const funds = fundsResult.data ?? [];
  const rounds = roundsResult.data ?? [];
  const investments = (investmentsResult.data ??
    []) as unknown as InvestmentRecord[];
  const portfolioInvestments = investments.map(portfolioInput);
  const portfolioMetrics = calculatePortfolioMetrics(
    portfolioInvestments,
    today,
  );
  const dealMetrics = new Map(
    investments.map((investment) => [
      investment.id,
      calculateInvestmentMetrics(portfolioInput(investment), today),
    ]),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Portfolio</h1>
          <p>
            {portfolioMetrics.activeInvestments} active investments ·{" "}
            {portfolioMetrics.markedAboveCost} marked above cost
            {portfolioMetrics.markDate
              ? ` · marks through ${formatDate(portfolioMetrics.markDate)}`
              : ""}
          </p>
        </div>
        <a className="button" href="#portfolio-actions">
          Add investment
        </a>
      </header>

      {error ? (
        <p className="alert">
          {errorMessages[error] ?? "The portfolio update could not be saved."}
        </p>
      ) : null}

      <section className="grid three portfolio-stats">
        <article className="panel stat">
          <span className="record-meta">Invested</span>
          <strong>{formatMoney(portfolioMetrics.invested)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Fair value</span>
          <strong>{formatMoney(portfolioMetrics.currentValue)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">Total gain</span>
          <strong
            className={portfolioMetrics.gain < 0 ? "negative" : undefined}
          >
            {formatMoney(portfolioMetrics.gain)}
          </strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">MOIC</span>
          <strong>{formatMultiple(portfolioMetrics.moic)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">XIRR</span>
          <strong>{formatPercentage(portfolioMetrics.xirr)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            Cash returned · DPI {formatMultiple(portfolioMetrics.dpi)}
          </span>
          <strong>{formatMoney(portfolioMetrics.distributions)}</strong>
        </article>
      </section>

      <p className="calculation-note">
        XIRR uses each contribution, fee, and distribution on its actual date,
        plus the latest fair-value mark as the terminal value.
      </p>

      <section className="action-tray" id="portfolio-actions">
        <details className="action-panel" id="add-investment">
          <summary>Add investment</summary>
          <div className="action-panel-body">
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
                  Amount
                  <input
                    min="0.01"
                    name="amount"
                    placeholder="25000"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Invested on
                  <input name="invested_on" required type="date" />
                </label>
                <label>
                  Ownership %
                  <input
                    min="0"
                    name="ownership_percent"
                    placeholder="0.25"
                    step="any"
                    type="number"
                  />
                </label>
                <label>
                  Security
                  <input name="security" placeholder="SAFE, Preferred..." />
                </label>
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
                    {rounds.map((round) => {
                      const company = oneRelation(round.companies);
                      return (
                        <option key={round.id} value={round.id}>
                          {company?.name ?? "Unknown"} · {round.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Status
                  <select defaultValue="active" name="status">
                    <option value="active">Active</option>
                    <option value="watching">Watching</option>
                    <option value="exited">Exited</option>
                  </select>
                </label>
              </div>
              <button type="submit">Add investment</button>
            </form>
          </div>
        </details>

        <details className="action-panel">
          <summary>Record cash flow</summary>
          <div className="action-panel-body">
            <form action={createInvestmentCashFlow} className="form-stack">
              <label>
                Investment
                <select name="investment_id" required>
                  <option value="">Select investment</option>
                  {investments.map((investment) => (
                    <option key={investment.id} value={investment.id}>
                      {investmentName(investment)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Type
                  <select defaultValue="distribution" name="cash_flow_type">
                    <option value="distribution">Distribution</option>
                    <option value="fee">Fee</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    min="0.01"
                    name="amount"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Date
                  <input
                    defaultValue={today}
                    name="occurred_on"
                    required
                    type="date"
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  name="notes"
                  placeholder="Distribution notice, fee detail..."
                />
              </label>
              <button type="submit">Record cash flow</button>
            </form>
          </div>
        </details>

        <details className="action-panel">
          <summary>Add valuation mark</summary>
          <div className="action-panel-body">
            <form action={createInvestmentValuationMark} className="form-stack">
              <label>
                Investment
                <select name="investment_id" required>
                  <option value="">Select investment</option>
                  {investments.map((investment) => (
                    <option key={investment.id} value={investment.id}>
                      {investmentName(investment)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Fair value
                  <input
                    min="0"
                    name="fair_value"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Company valuation
                  <input
                    min="0"
                    name="company_valuation"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Valued on
                  <input
                    defaultValue={today}
                    name="valued_on"
                    required
                    type="date"
                  />
                </label>
                <label>
                  Source
                  <input name="source" placeholder="Financing, cap table..." />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  name="notes"
                  placeholder="Methodology or supporting context..."
                />
              </label>
              <button type="submit">Save valuation mark</button>
            </form>
          </div>
        </details>
      </section>

      <section className="portfolio-table-panel">
        <div className="sheet-toolbar">
          <div>
            <strong>Investment performance</strong>
          </div>
          <span className="record-meta">
            MOIC includes current value and cash returned.
          </span>
        </div>
        <div className="table-wrap">
          <table className="table portfolio-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Date</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Invested</th>
                <th>Valuation / cap</th>
                <th>Ownership</th>
                <th>Current value</th>
                <th>Cash returned</th>
                <th>MOIC</th>
                <th>XIRR</th>
                <th>Latest valuation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {investments.length ? (
                investments.map((investment) => {
                  const company = oneRelation(investment.companies);
                  const fund = oneRelation(investment.funds);
                  const round = oneRelation(investment.rounds);
                  const metrics = dealMetrics.get(investment.id);
                  const mark = latestMark(investment);

                  if (!metrics) {
                    return null;
                  }

                  return (
                    <tr key={investment.id}>
                      <td>
                        <span className="record-title">
                          {company?.id ? (
                            <Link href={`/companies/${company.id}`}>
                              {company.name}
                            </Link>
                          ) : (
                            "Unknown company"
                          )}
                        </span>
                        <span className="table-subline">
                          {fund?.name ? ` · ${fund.name}` : ""}
                        </span>
                      </td>
                      <td>{formatDate(investment.invested_on)}</td>
                      <td>{investment.security ?? "—"}</td>
                      <td>
                        <span className="pill">{company?.stage ?? "—"}</span>
                      </td>
                      <td className="numeric">
                        {formatMoney(metrics.invested, investment.currency)}
                      </td>
                      <td className="numeric">
                        {round?.post_money_valuation
                          ? formatMoney(
                              round.post_money_valuation,
                              investment.currency,
                            )
                          : "—"}
                      </td>
                      <td className="numeric">
                        {formatOwnership(investment.ownership_percent)}
                      </td>
                      <td className="numeric">
                        {formatMoney(metrics.currentValue, investment.currency)}
                      </td>
                      <td className="numeric">
                        {formatMoney(
                          metrics.distributions,
                          investment.currency,
                        )}
                      </td>
                      <td className="numeric">
                        {formatMultiple(metrics.moic)}
                      </td>
                      <td
                        className={`numeric${
                          metrics.xirr !== null && metrics.xirr < 0
                            ? " negative"
                            : ""
                        }`}
                      >
                        {formatPercentage(metrics.xirr)}
                      </td>
                      <td>
                        {mark?.company_valuation
                          ? formatMoney(
                              mark.company_valuation,
                              investment.currency,
                            )
                          : "—"}
                        {metrics.markDate ? (
                          <span className="table-subline">
                            {formatDate(metrics.markDate)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="pill">{investment.status}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13}>
                    <EmptyState>
                      Add the first investment to begin tracking returns.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="action-tray portfolio-structure-grid">
        <details className="action-panel">
          <summary>Add fund</summary>
          <div className="action-panel-body">
            <form action={createFund} className="form-stack">
              <div className="form-grid">
                <label>
                  Name
                  <input name="name" required />
                </label>
                <label>
                  Vintage year
                  <input inputMode="numeric" name="vintage_year" />
                </label>
              </div>
              <label>
                Description
                <textarea name="description" />
              </label>
              <button type="submit">Create fund</button>
            </form>
          </div>
        </details>

        <details className="action-panel">
          <summary>Add financing round</summary>
          <div className="action-panel-body">
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
                  <input
                    min="0"
                    name="amount_raised"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Post-money valuation
                  <input
                    min="0"
                    name="post_money_valuation"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
              <button type="submit">Create round</button>
            </form>
          </div>
        </details>
      </section>
    </>
  );
}
