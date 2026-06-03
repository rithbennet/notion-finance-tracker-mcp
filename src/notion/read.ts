import type { FindDuplicateExpenseInput, ListAccountsInput, ListBudgetsInput, ListMonthsInput } from "../domain/validation.js";
import type { DataSourceDefinition, DataSources } from "./schema.js";
import type { NotionClientLike, ResolvedPage } from "./types.js";

export type AccountSummary = {
  id: string;
  name: string;
  url?: string;
};

export type BudgetSummary = {
  id: string;
  name: string;
  url?: string;
  monthlyBudget?: number;
  includes?: string;
  excludes?: string;
  loggingRule?: string;
  purpose?: string;
};

export type MonthSummary = {
  id: string;
  name: string;
  url?: string;
};

export type ExpenseDuplicateCandidate = {
  id: string;
  expense: string;
  url?: string;
  amount?: number;
  date?: string;
  merchant?: string;
};

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function extractTitle(page: Record<string, unknown>, titleProperty: string): string {
  const properties = page.properties as Record<string, unknown> | undefined;
  const property = properties?.[titleProperty] as { title?: Array<{ plain_text?: string }> } | undefined;
  return property?.title?.map((part) => part.plain_text ?? "").join("") ?? "";
}

export function extractNumber(page: Record<string, unknown>, propertyName: string): number | undefined {
  const properties = page.properties as Record<string, unknown> | undefined;
  const property = properties?.[propertyName] as { number?: number | null } | undefined;
  return typeof property?.number === "number" ? property.number : undefined;
}

export function extractDateStart(page: Record<string, unknown>, propertyName: string): string | undefined {
  const properties = page.properties as Record<string, unknown> | undefined;
  const property = properties?.[propertyName] as { date?: { start?: string | null } | null } | undefined;
  return property?.date?.start ?? undefined;
}

export function extractRichText(page: Record<string, unknown>, propertyName: string): string | undefined {
  const properties = page.properties as Record<string, unknown> | undefined;
  const property = properties?.[propertyName] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const value = property?.rich_text?.map((part) => part.plain_text ?? "").join("").trim();
  return value || undefined;
}

export async function resolveByTitle(
  notion: NotionClientLike,
  source: DataSourceDefinition,
  title: string
): Promise<ResolvedPage> {
  const normalized = normalizeTitle(title);
  const exact = await queryByTitle(notion, source, title, "equals");
  const exactMatches = exact.filter((page) => normalizeTitle(page.title) === normalized);

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const fuzzy = await queryByTitle(notion, source, title, "contains");
  const normalizedMatches = fuzzy.filter((page) => normalizeTitle(page.title) === normalized);

  if (normalizedMatches.length === 1) {
    return normalizedMatches[0];
  }

  if (normalizedMatches.length > 1 || exactMatches.length > 1) {
    throw new Error(`Ambiguous ${source.key} title "${title}". Use the Notion page ID instead.`);
  }

  const suggestions = fuzzy.map((page) => page.title).filter(Boolean).slice(0, 5);
  const hint = suggestions.length ? ` Similar matches: ${suggestions.join(", ")}.` : "";
  throw new Error(`No ${source.key} row found with title "${title}".${hint}`);
}

export async function listAccounts(
  notion: NotionClientLike,
  dataSources: DataSources,
  input: ListAccountsInput
): Promise<AccountSummary[]> {
  const rows = await listRows(notion, dataSources.accounts, input);
  return rows.map((row) => ({
    id: row.id,
    name: row.title,
    url: row.url
  }));
}

export async function listBudgets(
  notion: NotionClientLike,
  dataSources: DataSources,
  input: ListBudgetsInput
): Promise<BudgetSummary[]> {
  const rows = await listRows(notion, dataSources.budget, input);
  return rows.map((row) => ({
    id: row.id,
    name: row.title,
    url: row.url,
    monthlyBudget: extractNumber(row.raw, "Monthly Budget"),
    includes: extractRichText(row.raw, "Includes"),
    excludes: extractRichText(row.raw, "Excludes"),
    loggingRule: extractRichText(row.raw, "Logging Rule"),
    purpose: extractRichText(row.raw, "Purpose")
  }));
}

export async function listMonths(
  notion: NotionClientLike,
  dataSources: DataSources,
  input: ListMonthsInput
): Promise<MonthSummary[]> {
  const rows = await listRows(notion, dataSources.months, input);
  return rows
    .filter((row) => (input.year ? row.title.includes(String(input.year)) : true))
    .map((row) => ({
      id: row.id,
      name: row.title,
      url: row.url
    }));
}

export async function findDuplicateExpenses(
  notion: NotionClientLike,
  dataSources: DataSources,
  input: FindDuplicateExpenseInput
): Promise<ExpenseDuplicateCandidate[]> {
  const filters: Record<string, unknown>[] = [];
  if (input.expense) {
    filters.push({
      property: dataSources.expenses.titleProperty,
      title: {
        contains: input.expense
      }
    });
  }
  if (input.amount) {
    filters.push({
      property: "Amount",
      number: {
        equals: input.amount
      }
    });
  }
  if (input.date) {
    filters.push({
      property: "Date",
      date: {
        equals: input.date.slice(0, 10)
      }
    });
  }
  if (input.merchant) {
    filters.push({
      property: "Merchant",
      rich_text: {
        contains: input.merchant
      }
    });
  }

  const response = await notion.dataSources.query({
    data_source_id: dataSources.expenses.id,
    filter: filters.length === 1 ? filters[0] : { and: filters },
    page_size: input.limit
  });

  return response.results.map((page) => ({
    id: String(page.id),
    expense: extractTitle(page, dataSources.expenses.titleProperty),
    url: typeof page.url === "string" ? page.url : undefined,
    amount: extractNumber(page, "Amount"),
    date: extractDateStart(page, "Date"),
    merchant: extractRichText(page, "Merchant")
  }));
}

export async function resolveExpenseRef(
  notion: NotionClientLike,
  expenses: DataSourceDefinition,
  input: { expenseId?: string; expense?: string }
): Promise<ResolvedPage> {
  if (input.expenseId) {
    const page = await notion.pages.retrieve({ page_id: input.expenseId });
    return {
      id: String(page.id),
      title: extractTitle(page, expenses.titleProperty),
      url: typeof page.url === "string" ? page.url : undefined
    };
  }

  if (!input.expense) {
    throw new Error("Provide expenseId or expense.");
  }

  return resolveByTitle(notion, expenses, input.expense);
}

async function listRows(
  notion: NotionClientLike,
  source: DataSourceDefinition,
  input: { query?: string; limit: number }
): Promise<Array<ResolvedPage & { raw: Record<string, unknown> }>> {
  const rows: Array<ResolvedPage & { raw: Record<string, unknown> }> = [];
  let startCursor: string | undefined;

  while (rows.length < input.limit) {
    const response = await notion.dataSources.query({
      data_source_id: source.id,
      filter: input.query
        ? {
            property: source.titleProperty,
            title: {
              contains: input.query
            }
          }
        : undefined,
      page_size: Math.min(100, input.limit - rows.length),
      start_cursor: startCursor
    });

    rows.push(...response.results.map((page) => toResolvedRawPage(page, source)));
    if (!response.has_more || !response.next_cursor) {
      break;
    }
    startCursor = response.next_cursor;
  }

  return rows.sort((left, right) => left.title.localeCompare(right.title));
}

export async function findDuplicateByTitleDateAmount(
  notion: NotionClientLike,
  source: DataSourceDefinition,
  title: string,
  date: string,
  amount: number
): Promise<ResolvedPage | undefined> {
  const candidates = await queryByTitle(notion, source, title, "equals");
  const normalized = normalizeTitle(title);
  const datePrefix = date.slice(0, 10);

  return candidates.find((page) => {
    const candidateDate = extractDateStart(page.raw, "Date")?.slice(0, 10);
    const candidateAmount = extractNumber(page.raw, "Amount");
    return normalizeTitle(page.title) === normalized && candidateDate === datePrefix && candidateAmount === amount;
  });
}

async function queryByTitle(
  notion: NotionClientLike,
  source: DataSourceDefinition,
  title: string,
  operator: "equals" | "contains"
): Promise<Array<ResolvedPage & { raw: Record<string, unknown> }>> {
  const response = await notion.dataSources.query({
    data_source_id: source.id,
    filter: {
      property: source.titleProperty,
      title: {
        [operator]: title
      }
    },
    page_size: 10
  });

  return response.results.map((page) => ({
    ...toResolvedRawPage(page, source),
    raw: page
  }));
}

function toResolvedRawPage(
  page: Record<string, unknown>,
  source: DataSourceDefinition
): ResolvedPage & { raw: Record<string, unknown> } {
  return {
    id: String(page.id),
    title: extractTitle(page, source.titleProperty),
    url: typeof page.url === "string" ? page.url : undefined,
    raw: page
  };
}
