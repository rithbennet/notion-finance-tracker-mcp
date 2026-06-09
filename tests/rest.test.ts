import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceRuntimeConfig, RuntimeEnv } from "../src/config.js";
import { handleFinanceApiRequest, isFinanceApiPath } from "../src/rest.js";

const { mockCreateNotionClient, mockQuery } = vi.hoisted(() => {
  const query = vi.fn();
  return {
    mockQuery: query,
    mockCreateNotionClient: vi.fn(() => ({
      dataSources: {
        query
      },
      pages: {
        create: vi.fn(),
        update: vi.fn(),
        retrieve: vi.fn()
      }
    }))
  };
});

vi.mock("../src/notion/client.js", () => ({
  createNotionClient: mockCreateNotionClient
}));

const runtimeEnv: RuntimeEnv = {
  NOTION_API_KEY: "secret_test"
};

const config: FinanceRuntimeConfig = {
  notionApiKey: "secret_test",
  dataSourceIds: {
    expenses: "expenses-source",
    budget: "budget-source",
    incomes: "incomes-source",
    accounts: "accounts-source",
    transfers: "transfers-source",
    subscriptions: "subscriptions-source",
    goals: "goals-source",
    months: "months-source"
  },
  databaseIds: {
    expenses: "expenses-db",
    incomes: "incomes-db",
    transfers: "transfers-db"
  }
};

describe("finance REST adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({
      results: [],
      has_more: false
    });
  });

  it("identifies finance API paths", () => {
    expect(isFinanceApiPath("/openapi.json")).toBe(true);
    expect(isFinanceApiPath("/api/accounts")).toBe(true);
    expect(isFinanceApiPath("/mcp")).toBe(false);
  });

  it("handles CORS preflight without creating a Notion client", async () => {
    const response = await handleFinanceApiRequest(new Request("https://example.test/api/accounts", { method: "OPTIONS" }), runtimeEnv, config);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
    expect(mockCreateNotionClient).not.toHaveBeenCalled();
  });

  it("normalizes trailing slashes and coerces numeric query params", async () => {
    mockQuery.mockResolvedValueOnce({
      results: [
        {
          id: "account-id",
          url: "https://notion.test/account-id",
          properties: {
            Accounts: {
              title: [{ plain_text: "Wallet" }]
            }
          }
        }
      ],
      has_more: false
    });

    const response = await handleFinanceApiRequest(
      new Request("https://example.test/api/accounts/?query=wal&limit=1"),
      runtimeEnv,
      config
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "account-id",
        name: "Wallet",
        url: "https://notion.test/account-id"
      }
    ]);
    expect(mockQuery).toHaveBeenCalledWith({
      data_source_id: "accounts-source",
      filter: {
        property: "Accounts",
        title: {
          contains: "wal"
        }
      },
      page_size: 1,
      start_cursor: undefined
    });
  });

  it("returns validation issues for invalid query params", async () => {
    const response = await handleFinanceApiRequest(
      new Request("https://example.test/api/accounts?limit=abc"),
      runtimeEnv,
      config
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        message: "Invalid request.",
        issues: [
          {
            path: "limit",
            message: "Invalid input: expected number, received NaN"
          }
        ]
      }
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects JSON routes without an application/json content type", async () => {
    const response = await handleFinanceApiRequest(
      new Request("https://example.test/api/expenses/duplicates", {
        method: "POST",
        body: JSON.stringify({ expense: "Coffee" })
      }),
      runtimeEnv,
      config
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: {
        message: "Content-Type must be application/json."
      }
    });
  });

  it("returns a structured 404 for unknown finance routes", async () => {
    const response = await handleFinanceApiRequest(new Request("https://example.test/api/nope"), runtimeEnv, config);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        message: "No finance API route for GET /api/nope."
      }
    });
  });
});
