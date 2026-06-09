#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { getFinanceRuntimeConfig, SERVER_NAME, SERVER_VERSION, type FinanceRuntimeConfig } from "./config.js";
import { createNotionClient } from "./notion/client.js";
import type { NotionClientLike } from "./notion/types.js";
import { registerFinanceTools } from "./tools.js";

export function createServer(options: { config?: FinanceRuntimeConfig; notion?: NotionClientLike } = {}): McpServer {
  const config = options.config ?? getFinanceRuntimeConfig();
  const notion = options.notion ?? createNotionClient();
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  registerFinanceTools(server, notion, config);
  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
