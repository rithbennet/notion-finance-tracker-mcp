import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinanceRuntimeConfig } from "./config.js";
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

type ToolResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
};

export function registerFinanceTools(server: McpServer, notion: NotionClientLike, config: FinanceRuntimeConfig): void {
  const dataSources = createDataSources(config.dataSourceIds);

  server.registerTool(
    "finance_list_accounts",
    {
      title: "List Accounts",
      description: "List account names from the Notion finance tracker for logging resolution.",
      inputSchema: listAccountsSchema.shape,
      annotations: {
        openWorldHint: true,
        readOnlyHint: true
      }
    },
    async (input) => asToolResponse(await listAccounts(notion, dataSources, listAccountsSchema.parse(input)))
  );

  server.registerTool(
    "finance_list_budgets",
    {
      title: "List Budgets",
      description: "List budget categories and logging hints from the Notion finance tracker.",
      inputSchema: listBudgetsSchema.shape,
      annotations: {
        openWorldHint: true,
        readOnlyHint: true
      }
    },
    async (input) => asToolResponse(await listBudgets(notion, dataSources, listBudgetsSchema.parse(input)))
  );

  server.registerTool(
    "finance_list_months",
    {
      title: "List Months",
      description: "List month classification rows from the Notion finance tracker.",
      inputSchema: listMonthsSchema.shape,
      annotations: {
        openWorldHint: true,
        readOnlyHint: true
      }
    },
    async (input) => asToolResponse(await listMonths(notion, dataSources, listMonthsSchema.parse(input)))
  );

  server.registerTool(
    "finance_find_duplicate_expense",
    {
      title: "Find Duplicate Expense",
      description: "Find existing expense rows matching a proposed expense before writing.",
      inputSchema: findDuplicateExpenseSchema.shape,
      annotations: {
        openWorldHint: true,
        readOnlyHint: true
      }
    },
    async (input) => asToolResponse(await findDuplicateExpenses(notion, dataSources, findDuplicateExpenseSchema.parse(input)))
  );

  server.registerTool(
    "finance_create_expense",
    {
      title: "Create Expense",
      description: "Create one validated expense in the Notion finance tracker.",
      inputSchema: createExpenseSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await createExpense(notion, config, createExpenseSchema.parse(input)))
  );

  server.registerTool(
    "finance_create_income",
    {
      title: "Create Income",
      description: "Create one validated income row in the Notion finance tracker.",
      inputSchema: createIncomeSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await createIncome(notion, config, createIncomeSchema.parse(input)))
  );

  server.registerTool(
    "finance_create_transfer",
    {
      title: "Create Transfer",
      description: "Create one validated transfer between two Notion finance accounts.",
      inputSchema: createTransferSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await createTransfer(notion, config, createTransferSchema.parse(input)))
  );

  server.registerTool(
    "finance_update_expense_category",
    {
      title: "Update Expense Category",
      description: "Move one expense to a budget category and optionally replace tags or review status.",
      inputSchema: updateExpenseCategorySchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await updateExpenseCategory(notion, config, updateExpenseCategorySchema.parse(input)))
  );

  server.registerTool(
    "finance_mark_expense_reviewed",
    {
      title: "Mark Expense Reviewed",
      description: "Set the Review Status for one expense.",
      inputSchema: markExpenseReviewedSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await markExpenseReviewed(notion, config, markExpenseReviewedSchema.parse(input)))
  );

  server.registerTool(
    "finance_link_expense_to_subscription",
    {
      title: "Link Expense To Subscription",
      description: "Link one expense to one subscription row.",
      inputSchema: linkExpenseToSubscriptionSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await linkExpenseToSubscription(notion, config, linkExpenseToSubscriptionSchema.parse(input)))
  );

  server.registerTool(
    "finance_bulk_create_expense",
    {
      title: "Bulk Create Expenses",
      description: "Create up to 10 validated expenses in one call. Returns per-item success or error results.",
      inputSchema: bulkCreateExpenseSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await bulkCreateExpenses(notion, config, bulkCreateExpenseSchema.parse(input)))
  );

  server.registerTool(
    "finance_bulk_update_expense_category",
    {
      title: "Bulk Update Expense Categories",
      description: "Move up to 25 expenses to budget categories in one call. Returns per-item success or error results.",
      inputSchema: bulkUpdateExpenseCategorySchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await bulkUpdateExpenseCategories(notion, config, bulkUpdateExpenseCategorySchema.parse(input)))
  );

  server.registerTool(
    "finance_bulk_mark_expense_reviewed",
    {
      title: "Bulk Mark Expenses Reviewed",
      description: "Set the Review Status for up to 25 expenses in one call. Returns per-item success or error results.",
      inputSchema: bulkMarkExpenseReviewedSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async (input) => asToolResponse(await bulkMarkExpensesReviewed(notion, config, bulkMarkExpenseReviewedSchema.parse(input)))
  );
}

function asToolResponse(result: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
