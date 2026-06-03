import { describe, expect, it } from "vitest";
import { buildExpenseProperties, buildTransferProperties } from "../src/notion/properties.js";
import { extractRichText, extractTitle } from "../src/notion/read.js";

const account = { id: "account-id", title: "Wallet" };
const budget = { id: "budget-id", title: "Food" };
const subscription = { id: "subscription-id", title: "Spotify" };

describe("Notion property builders", () => {
  it("builds expense properties without computed fields", () => {
    const properties = buildExpenseProperties(
      {
        expense: "Spotify",
        amount: 15,
        date: "2026-06-03",
        account: "Wallet",
        budget: "Subscriptions",
        merchant: "Spotify",
        tags: ["Subscription"],
        withWho: [],
        subscription: "Spotify",
        reviewStatus: "Needs Review ⚠️"
      },
      { account, budget, subscription }
    );

    expect(properties.Expense).toEqual({ title: [{ text: { content: "Spotify" } }] });
    expect(properties.Amount).toEqual({ number: 15 });
    expect(properties.Accounts).toEqual({ relation: [{ id: "account-id" }] });
    expect(properties.Budget).toEqual({ relation: [{ id: "budget-id" }] });
    expect(properties["Subscription Link"]).toEqual({ relation: [{ id: "subscription-id" }] });
    expect(properties).not.toHaveProperty("This Month");
  });

  it("builds transfer relation properties", () => {
    const properties = buildTransferProperties(
      {
        transfer: "Top up goal",
        amount: 100,
        date: "2026-06-03",
        fromAccount: "Wallet",
        toAccount: "Savings"
      },
      {
        fromAccount: { id: "from", title: "Wallet" },
        toAccount: { id: "to", title: "Savings" }
      }
    );

    expect(properties["From Account"]).toEqual({ relation: [{ id: "from" }] });
    expect(properties["To Account"]).toEqual({ relation: [{ id: "to" }] });
  });

  it("extracts title and rich text from Notion page properties", () => {
    const page = {
      properties: {
        Expense: { title: [{ plain_text: "Coffee" }] },
        Merchant: { rich_text: [{ plain_text: "SF " }, { plain_text: "Coffee" }] }
      }
    };

    expect(extractTitle(page, "Expense")).toBe("Coffee");
    expect(extractRichText(page, "Merchant")).toBe("SF Coffee");
  });
});
