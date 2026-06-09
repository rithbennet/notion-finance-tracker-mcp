import { describe, expect, it } from "vitest";
import { gptActionsOpenApiSpec } from "../src/openapi.js";

const schemas = gptActionsOpenApiSpec.components.schemas as Record<string, Record<string, unknown>>;

describe("generated OpenAPI contract", () => {
  it("has no dangling component $refs", () => {
    const json = JSON.stringify(gptActionsOpenApiSpec);
    const referenced = new Set([...json.matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)].map((m) => m[1]));
    const defined = new Set(Object.keys(schemas));
    const missing = [...referenced].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it("derives request schemas from the zod validators", () => {
    const expense = schemas.CreateExpenseRequest;
    expect(expense.type).toBe("object");
    expect(expense.required).toEqual(expect.arrayContaining(["expense", "amount", "date", "account", "budget"]));

    const properties = expense.properties as Record<string, Record<string, unknown>>;
    expect(properties.amount.exclusiveMinimum).toBe(0);
    expect(properties.reviewStatus.default).toBe("Needs Review ⚠️");
  });

  it("does not expose the removed idempotencyKey field", () => {
    expect(JSON.stringify(gptActionsOpenApiSpec)).not.toContain("idempotencyKey");
  });

  it("bounds bulk create batches at 10 items", () => {
    const items = (schemas.BulkCreateExpenseRequest.properties as Record<string, Record<string, unknown>>).items;
    expect(items.maxItems).toBe(10);
  });
});
