import type { FinanceRuntimeConfig } from "../config.js";

export type DataSourceKey =
  | "expenses"
  | "budget"
  | "incomes"
  | "accounts"
  | "transfers"
  | "subscriptions"
  | "goals"
  | "months";

export type DataSourceDefinition = {
  key: DataSourceKey;
  id: string;
  titleProperty: string;
};

export type DataSources = Record<DataSourceKey, DataSourceDefinition>;

export function createDataSources(dataSourceIds: FinanceRuntimeConfig["dataSourceIds"]): DataSources {
  return {
    expenses: {
      key: "expenses",
      id: dataSourceIds.expenses,
      titleProperty: "Expense"
    },
    budget: {
      key: "budget",
      id: dataSourceIds.budget,
      titleProperty: "Categories"
    },
    incomes: {
      key: "incomes",
      id: dataSourceIds.incomes,
      titleProperty: "Income"
    },
    accounts: {
      key: "accounts",
      id: dataSourceIds.accounts,
      titleProperty: "Accounts"
    },
    transfers: {
      key: "transfers",
      id: dataSourceIds.transfers,
      titleProperty: "Transfer"
    },
    subscriptions: {
      key: "subscriptions",
      id: dataSourceIds.subscriptions,
      titleProperty: "Subscription"
    },
    goals: {
      key: "goals",
      id: dataSourceIds.goals,
      titleProperty: "Goal"
    },
    months: {
      key: "months",
      id: dataSourceIds.months,
      titleProperty: "Month"
    }
  };
}

export const reviewStatuses = ["Needs Review ⚠️", "Clean ✅", "Fixed 🔧", "Needs Review", "Clean"] as const;
export const incomeTypes = ["Salary", "Refund", "Other"] as const;
