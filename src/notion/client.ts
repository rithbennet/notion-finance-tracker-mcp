import { Client } from "@notionhq/client";
import { getRequiredNotionApiKey, type RuntimeEnv } from "../config.js";
import type { NotionClientLike } from "./types.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export function createNotionClient(env?: RuntimeEnv): NotionClientLike {
  const client = new Client({
    auth: getRequiredNotionApiKey(env),
    notionVersion: "2026-03-11"
  }) as unknown as NotionClientLike;

  return withRetry(client);
}

function withRetry(client: NotionClientLike): NotionClientLike {
  return {
    dataSources: {
      query: (args) => retry(() => client.dataSources.query(args))
    },
    pages: {
      create: (args) => retry(() => client.pages.create(args)),
      update: (args) => retry(() => client.pages.update(args)),
      retrieve: (args) => retry(() => client.pages.retrieve(args))
    }
  };
}

async function retry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES || !isRetryable(error)) {
        throw error;
      }
      await sleep(retryDelayMs(error, attempt));
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 429 || status === 409 || (status !== undefined && status >= 500);
}

function retryDelayMs(error: unknown, attempt: number): number {
  const retryAfter = retryAfterSeconds(error);
  if (retryAfter !== undefined) {
    return retryAfter * 1000;
  }
  return BASE_DELAY_MS * 2 ** attempt;
}

function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

function retryAfterSeconds(error: unknown): number | undefined {
  const headers = (error as { headers?: unknown })?.headers;
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : (headers as Record<string, string> | undefined)?.["retry-after"];
  if (!raw) {
    return undefined;
  }
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
