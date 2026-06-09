# Notion Finance MCP

Personal write-focused MCP server for the `Budget & Finance Tracker PRO` Notion workspace.

The server exposes finance-specific tools instead of generic Notion mutation tools. Codex can create and update finance records, but only through validated operations that match the tracker schema.

## Tools

- `finance_create_expense`
- `finance_create_income`
- `finance_create_transfer`
- `finance_update_expense_category`
- `finance_mark_expense_reviewed`
- `finance_link_expense_to_subscription`
- `finance_list_accounts`
- `finance_list_budgets`
- `finance_list_months`
- `finance_find_duplicate_expense`
- `finance_bulk_create_expense`
- `finance_bulk_update_expense_category`
- `finance_bulk_mark_expense_reviewed`

## Safety Model

- No generic `update_notion_page` tool.
- Read tools expose finance context without exposing generic Notion queries.
- Relation inputs use human names and must resolve to exactly one Notion row.
- Create tools check for duplicate title/date/amount records before writing.
- Update tools that accept an `expenseId` verify the page belongs to the Expenses data source before mutating it.
- Notion API calls retry with backoff on rate limits and transient 5xx errors.
- Formula, rollup, and created-time properties are never written.
- Local stdio write attempts are appended to `logs/finance-mcp-audit.jsonl`.
- Cloudflare Worker write attempts are emitted to Worker logs.
- New expenses default to `Needs Review ⚠️`.

## Setup

1. Create a Notion internal integration.
2. Share the relevant Notion finance tracker databases/pages with that integration.
3. Copy `.env.example` to `.env`.
4. Set `NOTION_API_KEY` and keep all required data-source/database IDs in `.env`.
5. Set `FINANCE_MCP_BEARER_TOKEN` before exposing the Worker remotely.
6. Build the server.

```bash
npm install
npm run build
```

## Run Locally

```bash
npm run dev
```

The server uses MCP stdio, so it waits for an MCP client on stdin/stdout.

## Run On Cloudflare Workers

This project also exposes the same tools as a remote MCP server using Cloudflare Workers, Durable Objects, and the `agents` MCP transport.

```bash
npm run cf:types
npm run cf:dev
```

The local Worker health endpoint is:

```text
http://localhost:8787/
```

The local MCP endpoint is:

```text
http://localhost:8787/mcp
```

The local GPT Actions OpenAPI schema is:

```text
http://localhost:8787/openapi.json
```

For deployment, keep `.env` as the source of truth:

```bash
npm run cf:dry-run
npm run cf:deploy
```

`cf:dev` loads `.env` with `--env-file .env`. `cf:deploy` uploads `.env` with `--secrets-file .env`, so Notion tokens and tracker IDs are not hardcoded in `wrangler.jsonc`.

After deployment, connect MCP clients to:

```text
https://<your-worker-subdomain>.workers.dev/mcp
```

Remote `/mcp` requests must include:

```text
Authorization: Bearer <FINANCE_MCP_BEARER_TOKEN>
```

## GPT Actions

Custom GPTs use REST actions described by OpenAPI, not the MCP JSON-RPC endpoint.

Use this schema URL in the GPT Actions editor after deploying:

```text
https://notion-finance-mcp.harith-bennett.workers.dev/openapi.json
```

Configure authentication in the GPT Action as:

```text
Authentication: API Key
Auth type: Bearer
API key: <FINANCE_MCP_BEARER_TOKEN>
```

Do not paste the bearer token into the OpenAPI schema. The schema declares bearer authentication, but the secret belongs in the GPT Action auth settings.

The REST action endpoints are:

- `GET /api/accounts`
- `GET /api/budgets`
- `GET /api/months`
- `POST /api/expenses/duplicates`
- `POST /api/expenses`
- `POST /api/expenses/bulk`
- `POST /api/incomes`
- `POST /api/transfers`
- `PATCH /api/expenses/category`
- `PATCH /api/expenses/category/bulk`
- `PATCH /api/expenses/review-status`
- `PATCH /api/expenses/review-status/bulk`
- `PATCH /api/expenses/subscription`

Bulk create endpoints accept up to 10 explicit expense records per request. Bulk update endpoints accept up to 25 explicit expense records per request. Bulk endpoints return per-item success or error results. They do not perform filter-based updates.

## Codex MCP Config

Add this to your Codex MCP config, adjusting the path if needed:

```toml
[mcp_servers.finance_notion]
command = "node"
args = ["/Users/harithbennet/Documents/notion-finance-tracker/dist/server.js"]

[mcp_servers.finance_notion.env]
NOTION_API_KEY = "secret_xxx"
```

Keep write-tool approval enabled in Codex when connecting this server.

## Development

```bash
npm run typecheck
npm test
```
