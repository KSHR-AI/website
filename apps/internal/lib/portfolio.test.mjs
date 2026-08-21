import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateInvestmentMetrics,
  calculatePortfolioMetrics,
  calculateXirr,
} from "./portfolio.ts";

test("calculateXirr annualizes irregular dated cash flows", () => {
  const result = calculateXirr([
    { amount: -1_000, date: "2024-01-01" },
    { amount: 1_100, date: "2025-01-01" },
  ]);

  assert.ok(result !== null);
  assert.ok(Math.abs(result - 0.0997) < 0.001);
});

test("calculateXirr returns null without both an outflow and an inflow", () => {
  assert.equal(calculateXirr([{ amount: -1_000, date: "2024-01-01" }]), null);
});

test("investment metrics include distributions and the latest valuation", () => {
  const metrics = calculateInvestmentMetrics(
    {
      amount: 1_000,
      cashFlows: [
        {
          amount: 1_000,
          cash_flow_type: "contribution",
          occurred_on: "2024-01-01",
        },
        {
          amount: 100,
          cash_flow_type: "distribution",
          occurred_on: "2024-06-01",
        },
      ],
      investedOn: "2024-01-01",
      status: "active",
      valuations: [
        { fair_value: 1_500, valued_on: "2025-01-01" },
        { fair_value: 1_200, valued_on: "2024-09-01" },
      ],
    },
    "2025-01-01",
  );

  assert.equal(metrics.invested, 1_000);
  assert.equal(metrics.currentValue, 1_500);
  assert.equal(metrics.distributions, 100);
  assert.equal(metrics.moic, 1.6);
  assert.equal(metrics.dpi, 0.1);
  assert.equal(metrics.rvpi, 1.5);
  assert.equal(metrics.tvpi, 1.6);
  assert.equal(metrics.markDate, "2025-01-01");
});

test("portfolio metrics aggregate deal cash flows instead of averaging deal IRRs", () => {
  const metrics = calculatePortfolioMetrics(
    [
      {
        amount: 1_000,
        cashFlows: [
          {
            amount: 1_000,
            cash_flow_type: "contribution",
            occurred_on: "2024-01-01",
          },
        ],
        investedOn: "2024-01-01",
        status: "active",
        valuations: [{ fair_value: 2_000, valued_on: "2025-01-01" }],
      },
      {
        amount: 2_000,
        cashFlows: [
          {
            amount: 2_000,
            cash_flow_type: "contribution",
            occurred_on: "2024-07-01",
          },
        ],
        investedOn: "2024-07-01",
        status: "active",
        valuations: [{ fair_value: 2_000, valued_on: "2025-01-01" }],
      },
    ],
    "2025-01-01",
  );

  assert.equal(metrics.invested, 3_000);
  assert.equal(metrics.currentValue, 4_000);
  assert.equal(metrics.moic, 4 / 3);
  assert.equal(metrics.dpi, 0);
  assert.equal(metrics.rvpi, 4 / 3);
  assert.equal(metrics.tvpi, 4 / 3);
  assert.equal(metrics.activeInvestments, 2);
  assert.equal(metrics.markedAboveCost, 1);
  assert.ok(metrics.xirr !== null && metrics.xirr > 0);
});
