import { Client } from "@notionhq/client";
import { getRequiredNotionApiKey, type RuntimeEnv } from "../config.js";
import type { NotionClientLike } from "./types.js";

export function createNotionClient(env?: RuntimeEnv): NotionClientLike {
  return new Client({
    auth: getRequiredNotionApiKey(env),
    notionVersion: "2026-03-11"
  }) as unknown as NotionClientLike;
}
