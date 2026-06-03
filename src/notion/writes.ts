import { appendAuditRecord } from "../audit.js";
import type { FinanceRuntimeConfig } from "../config.js";
import type {
  BulkCreateExpenseInput,
  BulkMarkExpenseReviewedInput,
  BulkUpdateExpenseCategoryInput,
  CreateExpenseInput,
  CreateIncomeInput,
  CreateTransferInput,
  LinkExpenseToSubscriptionInput,
  MarkExpenseReviewedInput,
  UpdateExpenseCategoryInput
} from "../domain/validation.js";
import {
  buildExpenseProperties,
  buildIncomeProperties,
  buildTransferProperties,
  multiSelectProperty,
  relationProperty,
  selectProperty
} from "./properties.js";
import { findDuplicateByTitleDateAmount, resolveByTitle, resolveExpenseRef } from "./read.js";
import { createDataSources } from "./schema.js";
import type { NotionClientLike, ResolvedPage } from "./types.js";

export type WriteResult = {
  ok: boolean;
  action: string;
  pageId?: string;
  url?: string;
  duplicate?: boolean;
  summary: string;
};

export type BulkWriteItemResult = {
  index: number;
  ok: boolean;
  result?: WriteResult;
  error?: {
    name?: string;
    message: string;
  };
};

export type BulkWriteResult = {
  ok: boolean;
  action: string;
  total: number;
  succeeded: number;
  failed: number;
  results: BulkWriteItemResult[];
};

export async function createExpense(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: CreateExpenseInput
): Promise<WriteResult> {
  return audited("finance_create_expense", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const existing = await findDuplicateByTitleDateAmount(notion, dataSources.expenses, input.expense, input.date, input.amount);
    if (existing) {
      return duplicateResult("finance_create_expense", existing, `Expense already exists: ${existing.title}`);
    }

    const relations = {
      account: await resolveByTitle(notion, dataSources.accounts, input.account),
      budget: await resolveByTitle(notion, dataSources.budget, input.budget),
      month: input.month ? await resolveByTitle(notion, dataSources.months, input.month) : undefined,
      subscription: input.subscription ? await resolveByTitle(notion, dataSources.subscriptions, input.subscription) : undefined
    };

    const page = await notion.pages.create({
      parent: {
        database_id: config.databaseIds.expenses
      },
      properties: buildExpenseProperties(input, relations)
    });

    return pageResult("finance_create_expense", page, `Created expense "${input.expense}" for RM ${input.amount}.`);
  });
}

export async function bulkCreateExpenses(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: BulkCreateExpenseInput
): Promise<BulkWriteResult> {
  return runBulk("finance_bulk_create_expense", input, input.items, (item) => createExpense(notion, config, item));
}

export async function createIncome(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: CreateIncomeInput
): Promise<WriteResult> {
  return audited("finance_create_income", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const existing = await findDuplicateByTitleDateAmount(notion, dataSources.incomes, input.income, input.date, input.amount);
    if (existing) {
      return duplicateResult("finance_create_income", existing, `Income already exists: ${existing.title}`);
    }

    const relations = {
      account: await resolveByTitle(notion, dataSources.accounts, input.account),
      month: input.month ? await resolveByTitle(notion, dataSources.months, input.month) : undefined
    };

    const page = await notion.pages.create({
      parent: {
        database_id: config.databaseIds.incomes
      },
      properties: buildIncomeProperties(input, relations)
    });

    return pageResult("finance_create_income", page, `Created income "${input.income}" for RM ${input.amount}.`);
  });
}

export async function createTransfer(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: CreateTransferInput
): Promise<WriteResult> {
  return audited("finance_create_transfer", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const existing = await findDuplicateByTitleDateAmount(notion, dataSources.transfers, input.transfer, input.date, input.amount);
    if (existing) {
      return duplicateResult("finance_create_transfer", existing, `Transfer already exists: ${existing.title}`);
    }

    const relations = {
      fromAccount: await resolveByTitle(notion, dataSources.accounts, input.fromAccount),
      toAccount: await resolveByTitle(notion, dataSources.accounts, input.toAccount),
      goal: input.goal ? await resolveByTitle(notion, dataSources.goals, input.goal) : undefined
    };

    const page = await notion.pages.create({
      parent: {
        database_id: config.databaseIds.transfers
      },
      properties: buildTransferProperties(input, relations)
    });

    return pageResult("finance_create_transfer", page, `Created transfer "${input.transfer}" for RM ${input.amount}.`);
  });
}

export async function updateExpenseCategory(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: UpdateExpenseCategoryInput
): Promise<WriteResult> {
  return audited("finance_update_expense_category", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const expense = await resolveExpenseRef(notion, dataSources.expenses, input);
    const budget = await resolveByTitle(notion, dataSources.budget, input.budget);
    const properties: Record<string, unknown> = {
      Budget: relationProperty([budget])
    };

    if (input.tags.length > 0) {
      properties.Tags = multiSelectProperty(input.tags);
    }
    if (input.reviewStatus) {
      properties["Review Status"] = selectProperty(input.reviewStatus);
    }

    const page = await notion.pages.update({
      page_id: expense.id,
      properties
    });

    return pageResult(
      "finance_update_expense_category",
      page,
      `Updated expense "${expense.title || expense.id}" to budget "${budget.title}".`
    );
  });
}

export async function bulkUpdateExpenseCategories(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: BulkUpdateExpenseCategoryInput
): Promise<BulkWriteResult> {
  return runBulk("finance_bulk_update_expense_category", input, input.items, (item) => updateExpenseCategory(notion, config, item));
}

export async function markExpenseReviewed(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: MarkExpenseReviewedInput
): Promise<WriteResult> {
  return audited("finance_mark_expense_reviewed", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const expense = await resolveExpenseRef(notion, dataSources.expenses, input);
    const page = await notion.pages.update({
      page_id: expense.id,
      properties: {
        "Review Status": selectProperty(input.reviewStatus)
      }
    });

    return pageResult(
      "finance_mark_expense_reviewed",
      page,
      `Set expense "${expense.title || expense.id}" review status to "${input.reviewStatus}".`
    );
  });
}

export async function bulkMarkExpensesReviewed(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: BulkMarkExpenseReviewedInput
): Promise<BulkWriteResult> {
  return runBulk("finance_bulk_mark_expense_reviewed", input, input.items, (item) => markExpenseReviewed(notion, config, item));
}

export async function linkExpenseToSubscription(
  notion: NotionClientLike,
  config: FinanceRuntimeConfig,
  input: LinkExpenseToSubscriptionInput
): Promise<WriteResult> {
  return audited("finance_link_expense_to_subscription", input, async () => {
    const dataSources = createDataSources(config.dataSourceIds);
    const expense = await resolveExpenseRef(notion, dataSources.expenses, input);
    const subscription = await resolveByTitle(notion, dataSources.subscriptions, input.subscription);
    const page = await notion.pages.update({
      page_id: expense.id,
      properties: {
        "Subscription Link": relationProperty([subscription])
      }
    });

    return pageResult(
      "finance_link_expense_to_subscription",
      page,
      `Linked expense "${expense.title || expense.id}" to subscription "${subscription.title}".`
    );
  });
}

async function audited(action: string, input: unknown, run: () => Promise<WriteResult>): Promise<WriteResult> {
  try {
    const result = await run();
    await appendAuditRecord({ action, input, result });
    return result;
  } catch (error) {
    await appendAuditRecord({
      action,
      input,
      error: error instanceof Error ? { message: error.message, name: error.name } : error
    });
    throw error;
  }
}

async function runBulk<T>(
  action: string,
  input: unknown,
  items: T[],
  runItem: (item: T) => Promise<WriteResult>
): Promise<BulkWriteResult> {
  const results: BulkWriteItemResult[] = [];

  for (const [index, item] of items.entries()) {
    try {
      results.push({
        index,
        ok: true,
        result: await runItem(item)
      });
    } catch (error) {
      results.push({
        index,
        ok: false,
        error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }
      });
    }
  }

  const summary = {
    ok: results.every((result) => result.ok),
    action,
    total: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results
  };

  await appendAuditRecord({ action, input, result: summary });
  return summary;
}

function pageResult(action: string, page: Record<string, unknown>, summary: string): WriteResult {
  return {
    ok: true,
    action,
    pageId: typeof page.id === "string" ? page.id : undefined,
    url: typeof page.url === "string" ? page.url : undefined,
    summary
  };
}

function duplicateResult(action: string, page: ResolvedPage, summary: string): WriteResult {
  return {
    ok: true,
    action,
    pageId: page.id,
    url: page.url,
    duplicate: true,
    summary
  };
}
