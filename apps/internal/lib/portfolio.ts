const DAY_MS = 86_400_000;
const XIRR_YEAR_DAYS = 365;

type Numeric = number | string | null | undefined;

export type InvestmentCashFlow = {
  amount: Numeric;
  cash_flow_type: "contribution" | "distribution" | "fee";
  occurred_on: string;
};

export type InvestmentValuation = {
  fair_value: Numeric;
  valued_on: string;
};

export type PortfolioInvestment = {
  amount: Numeric;
  cashFlows: InvestmentCashFlow[];
  investedOn: string | null;
  status: string;
  valuations: InvestmentValuation[];
};

export type DatedCashFlow = {
  amount: number;
  date: string;
};

export type InvestmentReturnMetrics = {
  currentValue: number;
  distributions: number;
  dpi: number | null;
  fees: number;
  gain: number;
  invested: number;
  markDate: string | null;
  moic: number | null;
  paidIn: number;
  totalValue: number;
  xirr: number | null;
};

export type PortfolioReturnMetrics = InvestmentReturnMetrics & {
  activeInvestments: number;
  markedAboveCost: number;
};

function numeric(value: Numeric) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateTimestamp(value: string) {
  const timestamp = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeCashFlows(cashFlows: DatedCashFlow[]) {
  const byDate = new Map<string, number>();

  for (const cashFlow of cashFlows) {
    const date = cashFlow.date.slice(0, 10);
    if (
      dateTimestamp(date) === null ||
      !Number.isFinite(cashFlow.amount) ||
      cashFlow.amount === 0
    ) {
      continue;
    }
    byDate.set(date, (byDate.get(date) ?? 0) + cashFlow.amount);
  }

  return [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .filter((cashFlow) => Math.abs(cashFlow.amount) > 0.000_001)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function xnpv(rate: number, cashFlows: DatedCashFlow[]) {
  if (rate <= -1 || cashFlows.length === 0) {
    return Number.NaN;
  }

  const firstTimestamp = dateTimestamp(cashFlows[0].date);
  if (firstTimestamp === null) {
    return Number.NaN;
  }

  return cashFlows.reduce((value, cashFlow) => {
    const timestamp = dateTimestamp(cashFlow.date);
    if (timestamp === null) {
      return Number.NaN;
    }

    const years = (timestamp - firstTimestamp) / (DAY_MS * XIRR_YEAR_DAYS);
    return value + cashFlow.amount / Math.pow(1 + rate, years);
  }, 0);
}

function xnpvDerivative(rate: number, cashFlows: DatedCashFlow[]) {
  if (rate <= -1 || cashFlows.length === 0) {
    return Number.NaN;
  }

  const firstTimestamp = dateTimestamp(cashFlows[0].date);
  if (firstTimestamp === null) {
    return Number.NaN;
  }

  return cashFlows.reduce((value, cashFlow) => {
    const timestamp = dateTimestamp(cashFlow.date);
    if (timestamp === null) {
      return Number.NaN;
    }

    const years = (timestamp - firstTimestamp) / (DAY_MS * XIRR_YEAR_DAYS);
    return value - (years * cashFlow.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

export function calculateXirr(cashFlows: DatedCashFlow[]) {
  const flows = normalizeCashFlows(cashFlows);
  if (
    flows.length < 2 ||
    !flows.some((cashFlow) => cashFlow.amount < 0) ||
    !flows.some((cashFlow) => cashFlow.amount > 0)
  ) {
    return null;
  }

  const scale = Math.max(
    ...flows.map((cashFlow) => Math.abs(cashFlow.amount)),
    1,
  );
  const tolerance = scale * 1e-9;
  let rate = 0.1;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const value = xnpv(rate, flows);
    if (Number.isFinite(value) && Math.abs(value) <= tolerance) {
      return rate;
    }

    const derivative = xnpvDerivative(rate, flows);
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(derivative) ||
      Math.abs(derivative) < 1e-12
    ) {
      break;
    }

    const nextRate = rate - value / derivative;
    if (
      !Number.isFinite(nextRate) ||
      nextRate <= -0.999_999 ||
      nextRate > 1e12
    ) {
      break;
    }
    rate = nextRate;
  }

  let low = -0.999_999;
  let high = 1;
  let lowValue = xnpv(low, flows);
  let highValue = xnpv(high, flows);

  while (
    Number.isFinite(highValue) &&
    Math.sign(lowValue) === Math.sign(highValue) &&
    high < 1e12
  ) {
    high = high * 10 + 1;
    highValue = xnpv(high, flows);
  }

  if (
    !Number.isFinite(lowValue) ||
    !Number.isFinite(highValue) ||
    Math.sign(lowValue) === Math.sign(highValue)
  ) {
    return null;
  }

  for (let iteration = 0; iteration < 240; iteration += 1) {
    const middle = (low + high) / 2;
    const middleValue = xnpv(middle, flows);
    if (!Number.isFinite(middleValue)) {
      return null;
    }
    if (Math.abs(middleValue) <= tolerance) {
      return middle;
    }

    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
      highValue = middleValue;
    }
  }

  return (low + high) / 2;
}

function latestValuation(valuations: InvestmentValuation[]) {
  return [...valuations]
    .filter((valuation) => dateTimestamp(valuation.valued_on) !== null)
    .sort((left, right) => right.valued_on.localeCompare(left.valued_on))[0];
}

function investmentCashFlowSeries(
  investment: PortfolioInvestment,
  currentValue: number,
  markDate: string | null,
) {
  const flows: DatedCashFlow[] = investment.cashFlows.map((cashFlow) => ({
    amount:
      cashFlow.cash_flow_type === "distribution"
        ? numeric(cashFlow.amount)
        : -numeric(cashFlow.amount),
    date: cashFlow.occurred_on,
  }));

  const hasContribution = investment.cashFlows.some(
    (cashFlow) => cashFlow.cash_flow_type === "contribution",
  );
  if (
    !hasContribution &&
    investment.investedOn &&
    numeric(investment.amount) > 0
  ) {
    flows.push({
      amount: -numeric(investment.amount),
      date: investment.investedOn,
    });
  }
  if (currentValue > 0 && markDate) {
    flows.push({ amount: currentValue, date: markDate });
  }

  return flows;
}

function calculateInvestment(investment: PortfolioInvestment, today: string) {
  const contributionFlows = investment.cashFlows.filter(
    (cashFlow) => cashFlow.cash_flow_type === "contribution",
  );
  const invested = contributionFlows.length
    ? contributionFlows.reduce(
        (sum, cashFlow) => sum + numeric(cashFlow.amount),
        0,
      )
    : numeric(investment.amount);
  const distributions = investment.cashFlows
    .filter((cashFlow) => cashFlow.cash_flow_type === "distribution")
    .reduce((sum, cashFlow) => sum + numeric(cashFlow.amount), 0);
  const fees = investment.cashFlows
    .filter((cashFlow) => cashFlow.cash_flow_type === "fee")
    .reduce((sum, cashFlow) => sum + numeric(cashFlow.amount), 0);
  const paidIn = invested + fees;
  const valuation = latestValuation(investment.valuations);
  const isActive =
    investment.status === "active" || investment.status === "watching";
  const currentValue = valuation
    ? numeric(valuation.fair_value)
    : isActive
      ? invested
      : 0;
  const markDate = valuation?.valued_on ?? (isActive ? today : null);
  const totalValue = currentValue + distributions;
  const flows = investmentCashFlowSeries(investment, currentValue, markDate);

  return {
    metrics: {
      currentValue,
      distributions,
      dpi: paidIn > 0 ? distributions / paidIn : null,
      fees,
      gain: totalValue - paidIn,
      invested,
      markDate,
      moic: paidIn > 0 ? totalValue / paidIn : null,
      paidIn,
      totalValue,
      xirr: calculateXirr(flows),
    } satisfies InvestmentReturnMetrics,
    flows,
  };
}

export function calculateInvestmentMetrics(
  investment: PortfolioInvestment,
  today = new Date().toISOString().slice(0, 10),
) {
  return calculateInvestment(investment, today).metrics;
}

export function calculatePortfolioMetrics(
  investments: PortfolioInvestment[],
  today = new Date().toISOString().slice(0, 10),
): PortfolioReturnMetrics {
  const calculated = investments.map((investment) => ({
    ...calculateInvestment(investment, today),
    status: investment.status,
  }));
  const totals = calculated.reduce(
    (sum, investment) => ({
      currentValue: sum.currentValue + investment.metrics.currentValue,
      distributions: sum.distributions + investment.metrics.distributions,
      fees: sum.fees + investment.metrics.fees,
      invested: sum.invested + investment.metrics.invested,
    }),
    { currentValue: 0, distributions: 0, fees: 0, invested: 0 },
  );
  const paidIn = totals.invested + totals.fees;
  const totalValue = totals.currentValue + totals.distributions;
  const portfolioFlows = calculated.flatMap((investment) => investment.flows);
  const latestMarkDate =
    calculated
      .map((investment) => investment.metrics.markDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null;

  return {
    activeInvestments: calculated.filter(
      (investment) =>
        investment.status === "active" || investment.status === "watching",
    ).length,
    currentValue: totals.currentValue,
    distributions: totals.distributions,
    dpi: paidIn > 0 ? totals.distributions / paidIn : null,
    fees: totals.fees,
    gain: totalValue - paidIn,
    invested: totals.invested,
    markedAboveCost: calculated.filter(
      (investment) =>
        investment.metrics.currentValue > investment.metrics.paidIn,
    ).length,
    markDate: latestMarkDate,
    moic: paidIn > 0 ? totalValue / paidIn : null,
    paidIn,
    totalValue,
    xirr: calculateXirr(portfolioFlows),
  };
}
