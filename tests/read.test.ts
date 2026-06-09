import { describe, expect, it, vi } from "vitest";
import { resolveByTitle, resolveExpenseRef } from "../src/notion/read.js";
import type { DataSourceDefinition } from "../src/notion/schema.js";
import type { NotionClientLike } from "../src/notion/types.js";

const expenses: DataSourceDefinition = {
  key: "expenses",
  id: "expenses-source",
  titleProperty: "Expense"
};

function titlePage(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    url: `https://notion.test/${id}`,
    properties: {
      Expense: { title: [{ plain_text: title }] }
    },
    ...extra
  };
}

function notionWith(overrides: Partial<NotionClientLike["pages"]> = {}, queryResults: Record<string, unknown>[][] = []): NotionClientLike {
  const query = vi.fn();
  for (const results of queryResults) {
    query.mockResolvedValueOnce({ results, has_more: false });
  }
  query.mockResolvedValue({ results: [], has_more: false });
  return {
    dataSources: { query },
    pages: {
      create: vi.fn(),
      update: vi.fn(),
      retrieve: vi.fn(),
      ...overrides
    }
  };
}

describe("resolveByTitle", () => {
  it("returns the single exact match", async () => {
    const notion = notionWith({}, [[titlePage("e1", "Lunch")]]);
    const resolved = await resolveByTitle(notion, expenses, "lunch");
    expect(resolved.id).toBe("e1");
  });

  it("throws when the title is ambiguous", async () => {
    const notion = notionWith({}, [[titlePage("e1", "Lunch"), titlePage("e2", "Lunch")]]);
    await expect(resolveByTitle(notion, expenses, "Lunch")).rejects.toThrow(/Ambiguous/);
  });

  it("throws with suggestions when no row matches", async () => {
    // exact query empty, fuzzy query returns near-misses
    const notion = notionWith({}, [[], [titlePage("e1", "Lunch Special"), titlePage("e2", "Lunchbox")]]);
    await expect(resolveByTitle(notion, expenses, "Lunch")).rejects.toThrow(/Similar matches: Lunch Special, Lunchbox/);
  });
});

describe("resolveExpenseRef by id", () => {
  it("accepts a page in the expenses data source", async () => {
    const retrieve = vi.fn().mockResolvedValue(
      titlePage("e1", "Lunch", { parent: { type: "data_source_id", data_source_id: "expenses-source" } })
    );
    const notion = notionWith({ retrieve });
    const resolved = await resolveExpenseRef(notion, expenses, { expenseId: "e1" });
    expect(resolved.title).toBe("Lunch");
  });

  it("rejects a page from a different data source", async () => {
    const retrieve = vi.fn().mockResolvedValue(
      titlePage("x1", "Some budget", { parent: { type: "data_source_id", data_source_id: "budget-source" } })
    );
    const notion = notionWith({ retrieve });
    await expect(resolveExpenseRef(notion, expenses, { expenseId: "x1" })).rejects.toThrow(/not in the expenses data source/);
  });

  it("rejects a page that lacks the expense title property when no parent id is present", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "x2",
      properties: { Categories: { title: [{ plain_text: "Food" }] } }
    });
    const notion = notionWith({ retrieve });
    await expect(resolveExpenseRef(notion, expenses, { expenseId: "x2" })).rejects.toThrow(/not a valid expenses row/);
  });
});
