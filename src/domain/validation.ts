import { z } from "zod";
import { incomeTypes, reviewStatuses } from "../notion/schema.js";

const trimmedString = z.string().trim().min(1);
const isoDate = trimmedString.refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected an ISO date or datetime string."
});
const positiveAmount = z.number().positive().finite();
const optionalNameList = z.array(trimmedString).default([]);
const resultLimit = z.number().int().positive().max(100).default(100);
const duplicateResultLimit = z.number().int().positive().max(50).default(10);
const bulkCreateItemLimit = 10;
const bulkItemLimit = 25;

export const createExpenseSchema = z.object({
  expense: trimmedString.describe("Expense title, e.g. Lunch at Nasi Kandar."),
  amount: positiveAmount.describe("Positive expense amount in MYR."),
  date: isoDate.describe("ISO date or datetime, e.g. 2026-06-03."),
  account: trimmedString.describe("Exact account name from the Accounts data source."),
  budget: trimmedString.describe("Exact budget category from the Budget data source."),
  merchant: trimmedString.optional().describe("Merchant/vendor name."),
  month: trimmedString.optional().describe("Optional Month Classification row title."),
  tags: optionalNameList.describe("Expense Tags multi-select values."),
  withWho: optionalNameList.describe("With Who multi-select values."),
  subscription: trimmedString.optional().describe("Optional subscription row to link."),
  reviewStatus: z.enum(reviewStatuses).default("Needs Review ⚠️")
});

export const createIncomeSchema = z.object({
  income: trimmedString.describe("Income title."),
  amount: positiveAmount.describe("Positive income amount in MYR."),
  date: isoDate.describe("ISO date or datetime, e.g. 2026-06-03."),
  account: trimmedString.describe("Exact account name from the Accounts data source."),
  type: z.enum(incomeTypes).default("Other"),
  month: trimmedString.optional().describe("Optional Month Classification row title.")
});

export const createTransferSchema = z.object({
  transfer: trimmedString.describe("Transfer title."),
  amount: positiveAmount.describe("Positive transfer amount in MYR."),
  date: isoDate.describe("ISO date or datetime, e.g. 2026-06-03."),
  fromAccount: trimmedString.describe("Exact source account name."),
  toAccount: trimmedString.describe("Exact destination account name."),
  goal: trimmedString.optional().describe("Optional goal row title.")
}).superRefine((value, ctx) => {
  if (value.fromAccount.toLowerCase() === value.toAccount.toLowerCase()) {
    ctx.addIssue({
      code: "custom",
      path: ["toAccount"],
      message: "fromAccount and toAccount must be different."
    });
  }
});

export const expenseRefSchema = z.object({
  expenseId: trimmedString.optional().describe("Existing Notion expense page ID."),
  expense: trimmedString.optional().describe("Existing expense title, used only when expenseId is omitted.")
}).refine((value) => Boolean(value.expenseId || value.expense), {
  message: "Provide expenseId or expense."
});

export const updateExpenseCategorySchema = expenseRefSchema.extend({
  budget: trimmedString.describe("Exact budget category from the Budget data source."),
  tags: optionalNameList.describe("Replacement tags. Leave empty to keep tags unchanged."),
  reviewStatus: z.enum(reviewStatuses).optional()
});

export const markExpenseReviewedSchema = expenseRefSchema.extend({
  reviewStatus: z.enum(reviewStatuses).default("Clean ✅")
});

export const linkExpenseToSubscriptionSchema = expenseRefSchema.extend({
  subscription: trimmedString.describe("Exact subscription title.")
});

export const bulkUpdateExpenseCategorySchema = z.object({
  items: z.array(updateExpenseCategorySchema).min(1).max(bulkItemLimit).describe("Explicit expense category updates. Maximum 25 items.")
});

export const bulkMarkExpenseReviewedSchema = z.object({
  items: z.array(markExpenseReviewedSchema).min(1).max(bulkItemLimit).describe("Explicit expense review-status updates. Maximum 25 items.")
});

export const bulkCreateExpenseSchema = z.object({
  items: z.array(createExpenseSchema).min(1).max(bulkCreateItemLimit).describe("Explicit expense creates. Maximum 10 items.")
});

export const listAccountsSchema = z.object({
  query: trimmedString.optional().describe("Optional account title search."),
  limit: resultLimit.describe("Maximum number of accounts to return.")
});

export const listBudgetsSchema = z.object({
  query: trimmedString.optional().describe("Optional budget category search."),
  limit: resultLimit.describe("Maximum number of budget categories to return.")
});

export const listMonthsSchema = z.object({
  query: trimmedString.optional().describe("Optional month title search, e.g. June 2026."),
  year: z.number().int().min(1900).max(3000).optional().describe("Optional year filter."),
  limit: resultLimit.describe("Maximum number of months to return.")
});

export const findDuplicateExpenseSchema = z.object({
  expense: trimmedString.optional().describe("Optional expense title search."),
  amount: positiveAmount.optional().describe("Optional exact amount in MYR."),
  date: isoDate.optional().describe("Optional exact ISO date, e.g. 2026-06-03."),
  merchant: trimmedString.optional().describe("Optional merchant text search."),
  limit: duplicateResultLimit.describe("Maximum number of duplicate candidates to return.")
}).refine((value) => Boolean(value.expense || value.amount || value.date || value.merchant), {
  message: "Provide at least one of expense, amount, date, or merchant."
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ExpenseRefInput = z.infer<typeof expenseRefSchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
export type MarkExpenseReviewedInput = z.infer<typeof markExpenseReviewedSchema>;
export type LinkExpenseToSubscriptionInput = z.infer<typeof linkExpenseToSubscriptionSchema>;
export type BulkCreateExpenseInput = z.infer<typeof bulkCreateExpenseSchema>;
export type BulkUpdateExpenseCategoryInput = z.infer<typeof bulkUpdateExpenseCategorySchema>;
export type BulkMarkExpenseReviewedInput = z.infer<typeof bulkMarkExpenseReviewedSchema>;
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
export type ListBudgetsInput = z.infer<typeof listBudgetsSchema>;
export type ListMonthsInput = z.infer<typeof listMonthsSchema>;
export type FindDuplicateExpenseInput = z.infer<typeof findDuplicateExpenseSchema>;
