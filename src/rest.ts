import { ZodError, type ZodType } from "zod";
import type { FinanceRuntimeConfig, RuntimeEnv } from "./config.js";
import {
  bulkCreateExpenseSchema,
  bulkMarkExpenseReviewedSchema,
  bulkUpdateExpenseCategorySchema,
  createExpenseSchema,
  createIncomeSchema,
  createTransferSchema,
  findDuplicateExpenseSchema,
  linkExpenseToSubscriptionSchema,
  listAccountsSchema,
  listBudgetsSchema,
  listMonthsSchema,
  markExpenseReviewedSchema,
  updateExpenseCategorySchema
} from "./domain/validation.js";
import { createNotionClient } from "./notion/client.js";
import { findDuplicateExpenses, listAccounts, listBudgets, listMonths } from "./notion/read.js";
import { createDataSources } from "./notion/schema.js";
import type { NotionClientLike } from "./notion/types.js";
import {
  bulkCreateExpenses,
  bulkMarkExpensesReviewed,
  bulkUpdateExpenseCategories,
  createExpense,
  createIncome,
  createTransfer,
  linkExpenseToSubscription,
  markExpenseReviewed,
  updateExpenseCategory
} from "./notion/writes.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};

type FinanceApiContext = {
  config: FinanceRuntimeConfig;
  notion: NotionClientLike;
};

export function isFinanceApiPath(pathname: string): boolean {
  return pathname === "/openapi.json" || pathname.startsWith("/api/");
}

export async function handleFinanceApiRequest(
  request: Request,
  runtimeEnv: RuntimeEnv,
  config: FinanceRuntimeConfig
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const context = {
    config,
    notion: createNotionClient(runtimeEnv)
  };

  try {
    return await routeFinanceApiRequest(request, context);
  } catch (error) {
    return errorResponse(error);
  }
}

async function routeFinanceApiRequest(request: Request, context: FinanceApiContext): Promise<Response> {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);
  const dataSources = createDataSources(context.config.dataSourceIds);

  if (request.method === "GET" && pathname === "/api/accounts") {
    return jsonResponse(await listAccounts(context.notion, dataSources, listAccountsSchema.parse(queryParams(url))));
  }

  if (request.method === "GET" && pathname === "/api/budgets") {
    return jsonResponse(await listBudgets(context.notion, dataSources, listBudgetsSchema.parse(queryParams(url))));
  }

  if (request.method === "GET" && pathname === "/api/months") {
    return jsonResponse(await listMonths(context.notion, dataSources, listMonthsSchema.parse(queryParams(url))));
  }

  if (request.method === "POST" && pathname === "/api/expenses/duplicates") {
    const input = await parseBody(request, findDuplicateExpenseSchema);
    return jsonResponse(await findDuplicateExpenses(context.notion, dataSources, input));
  }

  if (request.method === "POST" && pathname === "/api/expenses") {
    const input = await parseBody(request, createExpenseSchema);
    return jsonResponse(await createExpense(context.notion, context.config, input), 201);
  }

  if (request.method === "POST" && pathname === "/api/expenses/bulk") {
    const input = await parseBody(request, bulkCreateExpenseSchema);
    return jsonResponse(await bulkCreateExpenses(context.notion, context.config, input), 201);
  }

  if (request.method === "POST" && pathname === "/api/incomes") {
    const input = await parseBody(request, createIncomeSchema);
    return jsonResponse(await createIncome(context.notion, context.config, input), 201);
  }

  if (request.method === "POST" && pathname === "/api/transfers") {
    const input = await parseBody(request, createTransferSchema);
    return jsonResponse(await createTransfer(context.notion, context.config, input), 201);
  }

  if (request.method === "PATCH" && pathname === "/api/expenses/category") {
    const input = await parseBody(request, updateExpenseCategorySchema);
    return jsonResponse(await updateExpenseCategory(context.notion, context.config, input));
  }

  if (request.method === "PATCH" && pathname === "/api/expenses/category/bulk") {
    const input = await parseBody(request, bulkUpdateExpenseCategorySchema);
    return jsonResponse(await bulkUpdateExpenseCategories(context.notion, context.config, input));
  }

  if (request.method === "PATCH" && pathname === "/api/expenses/review-status") {
    const input = await parseBody(request, markExpenseReviewedSchema);
    return jsonResponse(await markExpenseReviewed(context.notion, context.config, input));
  }

  if (request.method === "PATCH" && pathname === "/api/expenses/review-status/bulk") {
    const input = await parseBody(request, bulkMarkExpenseReviewedSchema);
    return jsonResponse(await bulkMarkExpensesReviewed(context.notion, context.config, input));
  }

  if (request.method === "PATCH" && pathname === "/api/expenses/subscription") {
    const input = await parseBody(request, linkExpenseToSubscriptionSchema);
    return jsonResponse(await linkExpenseToSubscription(context.notion, context.config, input));
  }

  return jsonResponse(
    {
      error: {
        message: `No finance API route for ${request.method} ${pathname}.`
      }
    },
    404
  );
}

async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  return schema.parse(body);
}

function queryParams(url: URL): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = numericQueryKeys.has(key) ? Number(value) : value;
  }
  return params;
}

const numericQueryKeys = new Set(["limit", "year"]);

function normalizePath(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: corsHeaders
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: {
          message: error.message
        }
      },
      error.status
    );
  }

  if (error instanceof ZodError) {
    return jsonResponse(
      {
        error: {
          message: "Invalid request.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      },
      400
    );
  }

  return jsonResponse(
    {
      error: {
        message: error instanceof Error ? error.message : "Unexpected finance API error."
      }
    },
    500
  );
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
