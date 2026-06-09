import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentContext } from "agents";
import { McpAgent } from "agents/mcp";
import { getFinanceRuntimeConfig, SERVER_NAME, SERVER_VERSION, type RuntimeEnv } from "./config.js";
import { createNotionClient } from "./notion/client.js";
import { gptActionsOpenApiSpec } from "./openapi.js";
import { handleFinanceApiRequest, isFinanceApiPath } from "./rest.js";
import { registerFinanceTools } from "./tools.js";

type FinanceWorkerEnv = Cloudflare.Env & {
  FINANCE_MCP_BEARER_TOKEN?: string;
  NOTION_TOKEN?: string;
};
type FinanceWorkerState = Record<string, never>;
type FinanceWorkerProps = Record<string, never>;

const mcpCorsOptions = {
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  headers: "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
  exposeHeaders: "mcp-session-id"
};

export class FinanceMCP extends McpAgent<FinanceWorkerEnv, FinanceWorkerState, FinanceWorkerProps> {
  private readonly financeEnv: FinanceWorkerEnv;

  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  constructor(ctx: AgentContext, env: FinanceWorkerEnv) {
    super(ctx, env);
    this.financeEnv = env;
  }

  async init(): Promise<void> {
    const runtimeEnv = toRuntimeEnv(this.financeEnv);
    const config = getFinanceRuntimeConfig(runtimeEnv);
    registerFinanceTools(this.server, createNotionClient(runtimeEnv), config);
  }
}

const mcpHandler = FinanceMCP.serve("/mcp", {
  binding: "FinanceMCP",
  corsOptions: mcpCorsOptions
});

export default {
  async fetch(request: Request, env: FinanceWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const runtimeEnv = toRuntimeEnv(env);

    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        mcpPath: "/mcp",
        openApiPath: "/openapi.json",
        apiPath: "/api",
        protected: Boolean(getBearerToken(env))
      });
    }

    if (url.pathname === "/openapi.json" && request.method === "GET") {
      return Response.json(gptActionsOpenApiSpec, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type"
        }
      });
    }

    if (url.pathname === "/openapi.json" && request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type"
        }
      });
    }

    if (isFinanceApiPath(url.pathname) && url.pathname !== "/openapi.json") {
      if (request.method !== "OPTIONS") {
        const authFailure = authorizeRequest(request, env);
        if (authFailure) {
          return authFailure;
        }
      }
      return handleFinanceApiRequest(request, runtimeEnv, getFinanceRuntimeConfig(runtimeEnv));
    }

    if (!url.pathname.startsWith("/mcp")) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return mcpHandler.fetch(request, env, ctx);
    }

    const authFailure = authorizeRequest(request, env);
    if (authFailure) {
      return authFailure;
    }

    return mcpHandler.fetch(request, env, ctx);
  }
};

function authorizeRequest(request: Request, env: FinanceWorkerEnv): Response | undefined {
  const token = getBearerToken(env);
  const url = new URL(request.url);
  if (!token && isLocalHostname(url.hostname)) {
    return undefined;
  }

  if (!token) {
    return new Response("FINANCE_MCP_BEARER_TOKEN is required for remote MCP access.", { status: 503 });
  }

  if (request.headers.get("Authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer"
      }
    });
  }

  return undefined;
}

function getBearerToken(env: FinanceWorkerEnv): string | undefined {
  return env.FINANCE_MCP_BEARER_TOKEN?.trim() || undefined;
}

function toRuntimeEnv(env: FinanceWorkerEnv): RuntimeEnv {
  // config.readEnv only ever reads named string keys, so the Worker env (including
  // non-string bindings like the Durable Object) can be passed through directly.
  return env as unknown as RuntimeEnv;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
