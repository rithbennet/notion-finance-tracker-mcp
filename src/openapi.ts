import { z, type ZodType } from "zod";
import { SERVER_VERSION } from "./config.js";
import {
  bulkCreateExpenseSchema,
  bulkMarkExpenseReviewedSchema,
  bulkUpdateExpenseCategorySchema,
  createExpenseSchema,
  createIncomeSchema,
  createTransferSchema,
  findDuplicateExpenseSchema,
  linkExpenseToSubscriptionSchema,
  markExpenseReviewedSchema,
  updateExpenseCategorySchema
} from "./domain/validation.js";

// Request body schemas are generated from the same zod schemas the API validates against,
// so the published OpenAPI contract cannot drift from the actual request validation.
function requestSchema(schema: ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

const requestSchemas = {
  FindDuplicateExpenseRequest: requestSchema(findDuplicateExpenseSchema),
  CreateExpenseRequest: requestSchema(createExpenseSchema),
  CreateIncomeRequest: requestSchema(createIncomeSchema),
  CreateTransferRequest: requestSchema(createTransferSchema),
  UpdateExpenseCategoryRequest: requestSchema(updateExpenseCategorySchema),
  MarkExpenseReviewedRequest: requestSchema(markExpenseReviewedSchema),
  LinkExpenseToSubscriptionRequest: requestSchema(linkExpenseToSubscriptionSchema),
  BulkCreateExpenseRequest: requestSchema(bulkCreateExpenseSchema),
  BulkUpdateExpenseCategoryRequest: requestSchema(bulkUpdateExpenseCategorySchema),
  BulkMarkExpenseReviewedRequest: requestSchema(bulkMarkExpenseReviewedSchema)
};

const queryParameter = {
  name: "query",
  in: "query",
  description: "Optional title search string.",
  schema: {
    type: "string",
    minLength: 1
  }
} as const;

const limitParameter = {
  name: "limit",
  in: "query",
  description: "Maximum rows to return.",
  schema: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 100
  }
} as const;

export const gptActionsOpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Notion Finance Tracker Actions",
    version: SERVER_VERSION,
    description: "REST action adapter for the personal Notion finance tracker. Use these endpoints to read finance context and create or update validated finance records."
  },
  servers: [
    {
      url: "https://notion-finance-mcp.harith-bennett.workers.dev",
      description: "Production Cloudflare Worker"
    }
  ],
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    "/api/accounts": {
      get: {
        operationId: "listAccounts",
        summary: "List accounts",
        description: "List account names from the Notion finance tracker. Use this before logging expenses, incomes, or transfers.",
        parameters: [
          queryParameter,
          limitParameter
        ],
        responses: {
          "200": {
            description: "Accounts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/NamedPage" }
                }
              }
            }
          }
        }
      }
    },
    "/api/budgets": {
      get: {
        operationId: "listBudgets",
        summary: "List budgets",
        description: "List budget categories and context fields from the Notion finance tracker. Use this to resolve an expense budget before writing.",
        parameters: [
          queryParameter,
          limitParameter
        ],
        responses: {
          "200": {
            description: "Budgets",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Budget" }
                }
              }
            }
          }
        }
      }
    },
    "/api/months": {
      get: {
        operationId: "listMonths",
        summary: "List month classifications",
        description: "List Month Classification rows. Use this to resolve the month for a transaction date before writing.",
        parameters: [
          queryParameter,
          {
            name: "year",
            in: "query",
            description: "Optional year filter.",
            schema: {
              type: "integer",
              minimum: 1900,
              maximum: 3000
            }
          },
          limitParameter
        ],
        responses: {
          "200": {
            description: "Months",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/NamedPage" }
                }
              }
            }
          }
        }
      }
    },
    "/api/expenses/duplicates": {
      post: {
        operationId: "findDuplicateExpense",
        summary: "Find duplicate expenses",
        description: "Find existing expense rows before creating a new expense.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FindDuplicateExpenseRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Duplicate candidates",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ExpenseDuplicate" }
                }
              }
            }
          }
        }
      }
    },
    "/api/expenses": {
      post: {
        operationId: "createExpense",
        summary: "Create expense",
        description: "Create one validated expense. Call only after user confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateExpenseRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Created expense or duplicate result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/bulk": {
      post: {
        operationId: "bulkCreateExpenses",
        summary: "Bulk create expenses",
        description: "Create up to 10 explicit, validated expenses. Call only after user confirmation of the exact batch.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BulkCreateExpenseRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Bulk create result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkWriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/incomes": {
      post: {
        operationId: "createIncome",
        summary: "Create income",
        description: "Create one validated income record. Call only after user confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateIncomeRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Created income or duplicate result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/transfers": {
      post: {
        operationId: "createTransfer",
        summary: "Create transfer",
        description: "Create one validated transfer between two accounts. Never create transfer as expense plus income.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTransferRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Created transfer or duplicate result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/category": {
      patch: {
        operationId: "updateExpenseCategory",
        summary: "Update expense category",
        description: "Move one expense to a budget category and optionally replace tags or review status.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateExpenseCategoryRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated expense",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/category/bulk": {
      patch: {
        operationId: "bulkUpdateExpenseCategories",
        summary: "Bulk update expense categories",
        description: "Update budget category, tags, or review status for up to 25 explicit expenses. Call only after user confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BulkUpdateExpenseCategoryRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Bulk update result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkWriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/review-status": {
      patch: {
        operationId: "markExpenseReviewed",
        summary: "Mark expense reviewed",
        description: "Set the Review Status for one expense.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MarkExpenseReviewedRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated expense",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/review-status/bulk": {
      patch: {
        operationId: "bulkMarkExpensesReviewed",
        summary: "Bulk mark expenses reviewed",
        description: "Set review status for up to 25 explicit expenses. Call only after user confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BulkMarkExpenseReviewedRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Bulk update result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkWriteResult" }
              }
            }
          }
        }
      }
    },
    "/api/expenses/subscription": {
      patch: {
        operationId: "linkExpenseToSubscription",
        summary: "Link expense to subscription",
        description: "Link one expense to one subscription row. Use only when the user explicitly says the expense is recurring or subscription-related.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LinkExpenseToSubscriptionRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated expense",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "opaque"
      }
    },
    schemas: {
      NamedPage: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: { type: "string" }
        }
      },
      Budget: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: { type: "string" },
          monthlyBudget: { type: "number" },
          includes: { type: "string" },
          excludes: { type: "string" },
          loggingRule: { type: "string" },
          purpose: { type: "string" }
        }
      },
      ExpenseDuplicate: {
        type: "object",
        required: ["id", "expense"],
        properties: {
          id: { type: "string" },
          expense: { type: "string" },
          url: { type: "string" },
          amount: { type: "number" },
          date: { type: "string" },
          merchant: { type: "string" }
        }
      },
      ...requestSchemas,
      WriteResult: {
        type: "object",
        required: ["ok", "action", "summary"],
        properties: {
          ok: { type: "boolean" },
          action: { type: "string" },
          pageId: { type: "string" },
          url: { type: "string" },
          duplicate: { type: "boolean" },
          summary: { type: "string" }
        }
      },
      BulkWriteResult: {
        type: "object",
        required: ["ok", "action", "total", "succeeded", "failed", "results"],
        properties: {
          ok: { type: "boolean" },
          action: { type: "string" },
          total: { type: "integer" },
          succeeded: { type: "integer" },
          failed: { type: "integer" },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/BulkWriteItemResult" }
          }
        }
      },
      BulkWriteItemResult: {
        type: "object",
        required: ["index", "ok"],
        properties: {
          index: { type: "integer" },
          ok: { type: "boolean" },
          result: { $ref: "#/components/schemas/WriteResult" },
          error: {
            type: "object",
            properties: {
              name: { type: "string" },
              message: { type: "string" }
            }
          }
        }
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["message"],
            properties: {
              message: { type: "string" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    message: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
