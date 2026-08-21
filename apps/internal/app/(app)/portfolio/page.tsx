import { Fragment } from "react";
import Link from "next/link";

import {
  createInvestment,
  createInvestmentCashFlow,
  createInvestmentValuationMark,
  updateInvestment,
  updateInvestmentCashFlow,
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

type CashFlowRecord = {
  amount: number | string;
  cash_flow_type: string;
  id: string;
  is_initial_contribution: boolean;
  notes: string | null;
  occurred_on: string;
};

type ValuationMarkRecord = {
  company_valuation: number | string | null;
  fair_value: number | string;
  id: string;
  source: string | null;
  valued_on: string;
};

type InvestmentRecord = {
  amount: number | string | null;
  companies: Relation<{ id: string; name: string; stage: string }>;
  company_id: string;
  currency: string;
  id: string;
  invested_on: string | null;
  investment_cash_flows: CashFlowRecord[];
  investment_valuation_marks: ValuationMarkRecord[];
  ownership_percent: number | string | null;
  security: string | null;
  status: string;
};

const companyStages = [
  "prospect",
  "diligence",
  "portfolio",
  "passed",
  "exited",
];

const investmentStatuses = ["active", "watching", "exited"];

const errorMessages: Record<string, string> = {
  cash_flow_create_failed: "The cash flow could not be saved.",
  cash_flow_required: "Choose a holding, date, type, and positive amount.",
  cash_flow_update_failed: "The cash flow could not be updated.",
  cash_flow_update_required: "Cash-flow date, type, and amount are required.",
  investment_create_failed: "The holding could not be saved.",
  investment_required:
    "Company, investment date, and a positive amount are required.",
  investment_update_failed: "The holding changes could not be saved.",
  investment_update_required:
    "Company, date, amount, stage, and status are required.",
  valuation_mark_create_failed: "The valuation mark could not be saved.",
  valuation_mark_required:
    "Choose a holding, valuation date, and nonnegative fair value.",
};

const updatedMessages: Record<string, string> = {
  cash_flow: "Cash flow updated.",
  investment: "Holding updated.",
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
  return [...investment.investment_valuation_marks].sort((a, b) =>
    b.valued_on.localeCompare(a.valued_on),
  )[0];
}

export default async function PortfolioPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ edit?: string; error?: string; updated?: string }>;
}>) {
  const { edit, error, updated } = await searchParams;
  const { supabase } = await requireActiveUser();
  const today = new Date().toISOString().slice(0, 10);

  const [companiesResult, investmentsResult] = await Promise.all([
    supabase.from("companies").select("id,name,stage").order("name"),
    supabase
      .from("investments")
      .select(
        "id,company_id,amount,currency,ownership_percent,status,security,invested_on,companies(id,name,stage),investment_cash_flows(id,amount,cash_flow_type,occurred_on,notes,is_initial_contribution),investment_valuation_marks(id,fair_value,company_valuation,valued_on,source)",
      )
      .order("invested_on", { ascending: false }),
  ]);

  const companies = companiesResult.data ?? [];
  const investments = (investmentsResult.data ??
    []) as unknown as InvestmentRecord[];
  const portfolioMetrics = calculatePortfolioMetrics(
    investments.map(portfolioInput),
    today,
  );
  const dealMetrics = new Map(
    investments.map((investment) => [
      investment.id,
      calculateInvestmentMetrics(portfolioInput(investment), today),
    ]),
  );
  const editableCashFlows = investments
    .flatMap((investment) =>
      investment.investment_cash_flows
        .filter((cashFlow) => !cashFlow.is_initial_contribution)
        .map((cashFlow) => ({
          ...cashFlow,
          company: oneRelation(investment.companies)?.name ?? "Unknown company",
          investmentId: investment.id,
        })),
    )
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  return (
    <>
      <header className="page-header fund-header">
        <div>
          <p className="eyebrow">KSHR</p>
          <h1>Portfolio</h1>
          <p>
            {portfolioMetrics.activeInvestments} active holdings
            {portfolioMetrics.markDate
              ? ` · marks through ${formatDate(portfolioMetrics.markDate)}`
              : ""}
          </p>
        </div>
        <a className="button compact" href="#portfolio-actions">
          Add holding
        </a>
      </header>

      {error ? (
        <p className="alert">
          {errorMessages[error] ?? "The fund update could not be saved."}
        </p>
      ) : null}
      {updated ? (
        <p className="success">
          {updatedMessages[updated] ?? "Fund data updated."}
        </p>
      ) : null}

      <section className="portfolio-stats fund-stats" aria-label="Fund returns">
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="Capital invested plus any recorded fees">Paid in</abbr>
          </span>
          <strong>{formatMoney(portfolioMetrics.paidIn)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="The latest fair value of the unrealized portfolio">
              Residual value
            </abbr>
          </span>
          <strong>{formatMoney(portfolioMetrics.currentValue)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="Cash returned to KSHR">Distributions</abbr>
          </span>
          <strong>{formatMoney(portfolioMetrics.distributions)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="Total Value to Paid-In: distributions plus residual value, divided by paid-in capital">
              TVPI
            </abbr>
          </span>
          <strong>{formatMultiple(portfolioMetrics.tvpi)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="Distributions to Paid-In: cash returned divided by paid-in capital">
              DPI
            </abbr>
          </span>
          <strong>{formatMultiple(portfolioMetrics.dpi)}</strong>
        </article>
        <article className="panel stat">
          <span className="record-meta">
            <abbr title="Annualized return using the actual dates of every contribution, fee, distribution, and latest valuation">
              IRR
            </abbr>
          </span>
          <strong>{formatPercentage(portfolioMetrics.xirr)}</strong>
        </article>
      </section>

      <details className="returns-guide" id="fund-return-guide">
        <summary>How fund returns work</summary>
        <dl className="metric-definitions">
          <div>
            <dt>TVPI</dt>
            <dd>
              Total value ÷ paid-in capital. It combines realized cash and
              remaining fair value. TVPI = DPI + RVPI.
            </dd>
          </div>
          <div>
            <dt>DPI</dt>
            <dd>
              Distributions ÷ paid-in capital. This is the portion of the fund
              already returned in cash.
            </dd>
          </div>
          <div>
            <dt>RVPI</dt>
            <dd>
              Residual value ÷ paid-in capital. KSHR is currently at{" "}
              {formatMultiple(portfolioMetrics.rvpi)} RVPI.
            </dd>
          </div>
          <div>
            <dt>MOIC</dt>
            <dd>
              A holding&apos;s total value ÷ paid-in capital. It shows the
              multiple earned but does not account for time.
            </dd>
          </div>
          <div>
            <dt>IRR</dt>
            <dd>
              Annualized return using actual cash-flow dates. The latest fair
              value acts as the terminal value for unrealized holdings.
            </dd>
          </div>
        </dl>
      </details>

      <section className="portfolio-table-panel">
        <div className="sheet-toolbar">
          <div>
            <strong>Holdings</strong>
            <span className="toolbar-subline">
              Edit source values; returns recalculate automatically.
            </span>
          </div>
          <span className="record-meta">{investments.length} total</span>
        </div>
        <div className="table-wrap">
          <table className="table portfolio-table fund-holdings-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Invested</th>
                <th>Date</th>
                <th>Security</th>
                <th>Stage</th>
                <th>Ownership</th>
                <th>Fair value</th>
                <th>Distributed</th>
                <th>
                  <abbr title="Multiple on invested capital">MOIC</abbr>
                </th>
                <th>
                  <abbr title="Annualized return using actual cash-flow dates">
                    IRR
                  </abbr>
                </th>
                <th>Status</th>
                <th aria-label="Edit holding" />
              </tr>
            </thead>
            <tbody>
              {investments.length ? (
                investments.map((investment) => {
                  const company = oneRelation(investment.companies);
                  const metrics = dealMetrics.get(investment.id);
                  const mark = latestMark(investment);
                  const isEditing = edit === investment.id;

                  if (!metrics) {
                    return null;
                  }

                  return (
                    <Fragment key={investment.id}>
                      <tr id={`holding-${investment.id}`}>
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
                        </td>
                        <td className="numeric">
                          {formatMoney(metrics.invested, investment.currency)}
                        </td>
                        <td>{formatDate(investment.invested_on)}</td>
                        <td>{investment.security ?? "—"}</td>
                        <td>
                          <span className="pill">{company?.stage ?? "—"}</span>
                        </td>
                        <td className="numeric">
                          {formatOwnership(investment.ownership_percent)}
                        </td>
                        <td className="numeric">
                          {formatMoney(
                            metrics.currentValue,
                            investment.currency,
                          )}
                          {metrics.markDate ? (
                            <span className="table-subline">
                              {formatDate(metrics.markDate)}
                            </span>
                          ) : null}
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
                          <span className="pill">{investment.status}</span>
                        </td>
                        <td>
                          <Link
                            className="text-action"
                            href={
                              isEditing
                                ? `/portfolio#holding-${investment.id}`
                                : `/portfolio?edit=${investment.id}#holding-${investment.id}`
                            }
                          >
                            {isEditing ? "Close" : "Edit"}
                          </Link>
                        </td>
                      </tr>
                      {isEditing ? (
                        <tr className="holding-edit-row">
                          <td colSpan={12}>
                            <form
                              action={updateInvestment}
                              className="holding-editor"
                            >
                              <input
                                name="id"
                                type="hidden"
                                value={investment.id}
                              />
                              <input
                                name="company_id"
                                type="hidden"
                                value={investment.company_id}
                              />
                              <input
                                name="valuation_id"
                                type="hidden"
                                value={mark?.id ?? ""}
                              />
                              <div className="holding-editor-grid">
                                <label>
                                  Company
                                  <input
                                    defaultValue={company?.name ?? ""}
                                    name="company_name"
                                    required
                                  />
                                </label>
                                <label>
                                  Invested
                                  <input
                                    defaultValue={investment.amount ?? ""}
                                    min="0.01"
                                    name="amount"
                                    required
                                    step="0.01"
                                    type="number"
                                  />
                                </label>
                                <label>
                                  Investment date
                                  <input
                                    defaultValue={investment.invested_on ?? ""}
                                    name="invested_on"
                                    required
                                    type="date"
                                  />
                                </label>
                                <label>
                                  Security
                                  <input
                                    defaultValue={investment.security ?? ""}
                                    name="security"
                                    placeholder="SAFE, Preferred…"
                                  />
                                </label>
                                <label>
                                  Company stage
                                  <select
                                    defaultValue={company?.stage ?? "portfolio"}
                                    name="stage"
                                  >
                                    {companyStages.map((stage) => (
                                      <option key={stage} value={stage}>
                                        {stage}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Ownership %
                                  <input
                                    defaultValue={
                                      investment.ownership_percent ?? ""
                                    }
                                    min="0"
                                    name="ownership_percent"
                                    step="any"
                                    type="number"
                                  />
                                </label>
                                <label>
                                  Fair value
                                  <input
                                    defaultValue={mark?.fair_value ?? ""}
                                    min="0"
                                    name="fair_value"
                                    placeholder="Unrealized value"
                                    step="0.01"
                                    type="number"
                                  />
                                </label>
                                <label>
                                  Company valuation
                                  <input
                                    defaultValue={mark?.company_valuation ?? ""}
                                    min="0"
                                    name="company_valuation"
                                    step="0.01"
                                    type="number"
                                  />
                                </label>
                                <label>
                                  Mark date
                                  <input
                                    defaultValue={mark?.valued_on ?? today}
                                    name="valued_on"
                                    type="date"
                                  />
                                </label>
                                <label>
                                  Status
                                  <select
                                    defaultValue={investment.status}
                                    name="status"
                                  >
                                    {investmentStatuses.map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="form-actions">
                                <button className="compact" type="submit">
                                  Save changes
                                </button>
                                <Link
                                  className="button secondary compact"
                                  href={`/portfolio#holding-${investment.id}`}
                                >
                                  Cancel
                                </Link>
                                <span className="record-meta">
                                  MOIC and IRR recalculate from these values and
                                  the cash-flow ledger.
                                </span>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12}>
                    <EmptyState
                      actionHref="#portfolio-actions"
                      actionLabel="Add a holding"
                    >
                      Add the first holding to begin tracking fund returns.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="action-tray fund-actions" id="portfolio-actions">
        <details className="action-panel" id="add-investment">
          <summary>Add holding</summary>
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
                  Invested
                  <input
                    min="0.01"
                    name="amount"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Investment date
                  <input name="invested_on" required type="date" />
                </label>
                <label>
                  Ownership %
                  <input
                    min="0"
                    name="ownership_percent"
                    step="any"
                    type="number"
                  />
                </label>
                <label>
                  Security
                  <input name="security" placeholder="SAFE, Preferred…" />
                </label>
                <label>
                  Status
                  <select defaultValue="active" name="status">
                    {investmentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit">Add holding</button>
            </form>
          </div>
        </details>

        <details className="action-panel">
          <summary>Record cash flow</summary>
          <div className="action-panel-body">
            <form action={createInvestmentCashFlow} className="form-stack">
              <label>
                Holding
                <select name="investment_id" required>
                  <option value="">Select holding</option>
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
                <textarea name="notes" />
              </label>
              <button type="submit">Record cash flow</button>
            </form>
          </div>
        </details>

        <details className="action-panel">
          <summary>Add valuation</summary>
          <div className="action-panel-body">
            <form action={createInvestmentValuationMark} className="form-stack">
              <label>
                Holding
                <select name="investment_id" required>
                  <option value="">Select holding</option>
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
                  Mark date
                  <input
                    defaultValue={today}
                    name="valued_on"
                    required
                    type="date"
                  />
                </label>
                <label>
                  Source
                  <input name="source" placeholder="Financing, cap table…" />
                </label>
              </div>
              <label>
                Notes
                <textarea name="notes" />
              </label>
              <button type="submit">Save valuation</button>
            </form>
          </div>
        </details>
      </section>

      <details
        className="data-ledger"
        id="cash-flow-ledger"
        open={error?.startsWith("cash_flow_") || updated === "cash_flow"}
      >
        <summary>
          Cash-flow ledger
          <span>{editableCashFlows.length} distributions and fees</span>
        </summary>
        <p className="calculation-note">
          Initial contributions stay synchronized with each holding&apos;s
          invested amount and date.
        </p>
        <div className="table-wrap">
          <table className="table cash-flow-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Notes</th>
                <th aria-label="Save cash flow" />
              </tr>
            </thead>
            <tbody>
              {editableCashFlows.length ? (
                editableCashFlows.map((cashFlow) => {
                  const formId = `cash-flow-${cashFlow.id}`;

                  return (
                    <tr key={cashFlow.id}>
                      <td>
                        <form action={updateInvestmentCashFlow} id={formId}>
                          <input name="id" type="hidden" value={cashFlow.id} />
                          <input
                            name="investment_id"
                            type="hidden"
                            value={cashFlow.investmentId}
                          />
                        </form>
                        <span className="record-title">{cashFlow.company}</span>
                      </td>
                      <td>
                        <select
                          aria-label={`${cashFlow.company} cash-flow type`}
                          defaultValue={cashFlow.cash_flow_type}
                          form={formId}
                          name="cash_flow_type"
                        >
                          <option value="distribution">Distribution</option>
                          <option value="fee">Fee</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`${cashFlow.company} cash-flow date`}
                          defaultValue={cashFlow.occurred_on}
                          form={formId}
                          name="occurred_on"
                          required
                          type="date"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${cashFlow.company} cash-flow amount`}
                          defaultValue={cashFlow.amount}
                          form={formId}
                          min="0.01"
                          name="amount"
                          required
                          step="0.01"
                          type="number"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${cashFlow.company} cash-flow notes`}
                          defaultValue={cashFlow.notes ?? ""}
                          form={formId}
                          name="notes"
                        />
                      </td>
                      <td>
                        <button className="secondary compact" form={formId}>
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      actionHref="#portfolio-actions"
                      actionLabel="Record a cash flow"
                    >
                      No distributions or fees recorded yet.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
