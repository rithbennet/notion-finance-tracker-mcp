import path from "node:path";
import process from "node:process";

export type RuntimeEnv = Record<string, string | undefined>;

export type FinanceRuntimeConfig = {
  notionApiKey: string;
  bearerToken?: string;
  dataSourceIds: {
    expenses: string;
    budget: string;
    incomes: string;
    accounts: string;
    transfers: string;
    subscriptions: string;
    goals: string;
    months: string;
  };
  databaseIds: {
    expenses: string;
    incomes: string;
    transfers: string;
  };
};

function readEnv(name: string, env?: RuntimeEnv): string | undefined {
  return env?.[name]?.trim() || process.env[name]?.trim();
}

function requiredEnv(name: string, env?: RuntimeEnv): string {
  const value = readEnv(name, env);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Set it in .env or Codex MCP env.`);
  }
  return value;
}

export function getRequiredNotionApiKey(env?: RuntimeEnv): string {
  const token = readEnv("NOTION_API_KEY", env) || readEnv("NOTION_TOKEN", env);
  if (!token) {
    throw new Error("Missing NOTION_API_KEY. Create a Notion integration token and set it in .env or Codex MCP env.");
  }
  return token;
}

export function getFinanceRuntimeConfig(env?: RuntimeEnv): FinanceRuntimeConfig {
  return {
    notionApiKey: getRequiredNotionApiKey(env),
    bearerToken: readEnv("FINANCE_MCP_BEARER_TOKEN", env),
    dataSourceIds: {
      expenses: requiredEnv("NOTION_EXPENSES_DATA_SOURCE_ID", env),
      budget: requiredEnv("NOTION_BUDGET_DATA_SOURCE_ID", env),
      incomes: requiredEnv("NOTION_INCOMES_DATA_SOURCE_ID", env),
      accounts: requiredEnv("NOTION_ACCOUNTS_DATA_SOURCE_ID", env),
      transfers: requiredEnv("NOTION_TRANSFERS_DATA_SOURCE_ID", env),
      subscriptions: requiredEnv("NOTION_SUBSCRIPTIONS_DATA_SOURCE_ID", env),
      goals: requiredEnv("NOTION_GOALS_DATA_SOURCE_ID", env),
      months: requiredEnv("NOTION_MONTHS_DATA_SOURCE_ID", env)
    },
    databaseIds: {
      expenses: requiredEnv("NOTION_EXPENSES_DATABASE_ID", env),
      incomes: requiredEnv("NOTION_INCOMES_DATABASE_ID", env),
      transfers: requiredEnv("NOTION_TRANSFERS_DATABASE_ID", env)
    }
  };
}

export function getAuditLogPath(): string {
  const configured = process.env.FINANCE_MCP_AUDIT_LOG?.trim() || "logs/finance-mcp-audit.jsonl";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}
