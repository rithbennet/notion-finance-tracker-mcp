import { describe, expect, it } from "vitest";
import {
  bulkCreateExpenseSchema,
  bulkMarkExpenseReviewedSchema,
  bulkUpdateExpenseCategorySchema,
  createExpenseSchema,
  createTransferSchema,
  findDuplicateExpenseSchema,
  listAccountsSchema,
  markExpenseReviewedSchema
} from "../src/domain/validation.js";

describe("finance tool validation", () => {
  it("defaults new expenses to needs review", () => {
    const parsed = createExpenseSchema.parse({
      expense: "Lunch",
      amount: 12,
      date: "2026-06-03",
      account: "Wallet",
      budget: "Food"
    });

    expect(parsed.reviewStatus).toBe("Needs Review ⚠️");
    expect(parsed.tags).toEqual([]);
    expect(parsed.withWho).toEqual([]);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      createExpenseSchema.parse({
        expense: "Lunch",
        amount: 0,
        date: "2026-06-03",
        account: "Wallet",
        budget: "Food"
      })
    ).toThrow();
  });

  it("rejects transfers to the same account", () => {
    expect(() =>
      createTransferSchema.parse({
        transfer: "Move money",
        amount: 100,
        date: "2026-06-03",
        fromAccount: "Maybank",
        toAccount: "maybank"
      })
    ).toThrow();
  });

  it("allows expense references by page id", () => {
    const parsed = markExpenseReviewedSchema.parse({
      expenseId: "abc",
      reviewStatus: "Clean ✅"
    });

    expect(parsed.expenseId).toBe("abc");
  });

  it("defaults read list limits", () => {
    const parsed = listAccountsSchema.parse({});

    expect(parsed.limit).toBe(100);
  });

  it("requires at least one duplicate lookup field", () => {
    expect(() => findDuplicateExpenseSchema.parse({})).toThrow();
    expect(findDuplicateExpenseSchema.parse({ amount: 10.9 }).limit).toBe(10);
  });

  it("caps bulk update batches at 25 explicit items", () => {
    const item = {
      expenseId: "abc",
      budget: "Cafes",
      reviewStatus: "Clean ✅"
    };

    expect(bulkUpdateExpenseCategorySchema.parse({ items: [item] }).items).toHaveLength(1);
    expect(() => bulkUpdateExpenseCategorySchema.parse({ items: Array.from({ length: 26 }, () => item) })).toThrow();
  });

  it("caps bulk create batches at 10 explicit expenses", () => {
    const item = {
      expense: "Lunch",
      amount: 12,
      date: "2026-06-04",
      account: "Wallet",
      budget: "Food"
    };

    expect(bulkCreateExpenseSchema.parse({ items: [item] }).items).toHaveLength(1);
    expect(() => bulkCreateExpenseSchema.parse({ items: Array.from({ length: 11 }, () => item) })).toThrow();
  });

  it("caps bulk review batches at 25 explicit items", () => {
    const item = {
      expenseId: "abc",
      reviewStatus: "Clean ✅"
    };

    expect(bulkMarkExpenseReviewedSchema.parse({ items: [item] }).items).toHaveLength(1);
    expect(() => bulkMarkExpenseReviewedSchema.parse({ items: Array.from({ length: 26 }, () => item) })).toThrow();
  });
});
