import type {
  CreateExpenseInput,
  CreateIncomeInput,
  CreateTransferInput
} from "../domain/validation.js";
import type { ResolvedPage } from "./types.js";

type PropertyValue = Record<string, unknown>;
type PropertyMap = Record<string, PropertyValue>;

export function titleProperty(content: string): PropertyValue {
  return {
    title: [
      {
        text: {
          content
        }
      }
    ]
  };
}

export function richTextProperty(content: string | undefined): PropertyValue {
  return {
    rich_text: content
      ? [
          {
            text: {
              content
            }
          }
        ]
      : []
  };
}

export function dateProperty(start: string): PropertyValue {
  return {
    date: {
      start
    }
  };
}

export function relationProperty(pages: ResolvedPage[]): PropertyValue {
  return {
    relation: pages.map((page) => ({
      id: page.id
    }))
  };
}

export function selectProperty(name: string): PropertyValue {
  return {
    select: {
      name
    }
  };
}

export function multiSelectProperty(names: string[]): PropertyValue {
  return {
    multi_select: names.map((name) => ({
      name
    }))
  };
}

export type ResolvedExpenseRelations = {
  account: ResolvedPage;
  budget: ResolvedPage;
  month?: ResolvedPage;
  subscription?: ResolvedPage;
};

export type ResolvedIncomeRelations = {
  account: ResolvedPage;
  month?: ResolvedPage;
};

export type ResolvedTransferRelations = {
  fromAccount: ResolvedPage;
  toAccount: ResolvedPage;
  goal?: ResolvedPage;
};

export function buildExpenseProperties(input: CreateExpenseInput, relations: ResolvedExpenseRelations): PropertyMap {
  const properties: PropertyMap = {
    Expense: titleProperty(input.expense),
    Amount: {
      number: input.amount
    },
    Date: dateProperty(input.date),
    Accounts: relationProperty([relations.account]),
    Budget: relationProperty([relations.budget]),
    "Review Status": selectProperty(input.reviewStatus),
    Merchant: richTextProperty(input.merchant),
    Tags: multiSelectProperty(input.tags),
    "With Who": multiSelectProperty(input.withWho)
  };

  if (relations.month) {
    properties["Month Classification"] = relationProperty([relations.month]);
  }
  if (relations.subscription) {
    properties["Subscription Link"] = relationProperty([relations.subscription]);
  }

  return properties;
}

export function buildIncomeProperties(input: CreateIncomeInput, relations: ResolvedIncomeRelations): PropertyMap {
  const properties: PropertyMap = {
    Income: titleProperty(input.income),
    Amount: {
      number: input.amount
    },
    Date: dateProperty(input.date),
    Accounts: relationProperty([relations.account]),
    Type: selectProperty(input.type)
  };

  if (relations.month) {
    properties["Month Classification"] = relationProperty([relations.month]);
  }

  return properties;
}

export function buildTransferProperties(input: CreateTransferInput, relations: ResolvedTransferRelations): PropertyMap {
  const properties: PropertyMap = {
    Transfer: titleProperty(input.transfer),
    Amount: {
      number: input.amount
    },
    Date: dateProperty(input.date),
    "From Account": relationProperty([relations.fromAccount]),
    "To Account": relationProperty([relations.toAccount])
  };

  if (relations.goal) {
    properties.Goals = relationProperty([relations.goal]);
  }

  return properties;
}
