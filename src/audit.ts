export type AuditRecord = {
  action: string;
  input: unknown;
  resolved?: unknown;
  result?: unknown;
  error?: unknown;
};

export async function appendAuditRecord(record: AuditRecord): Promise<void> {
  const payload = {
    timestamp: new Date().toISOString(),
    ...record
  };

  if (!isNodeRuntime()) {
    console.log(JSON.stringify({ type: "finance_mcp_audit", ...payload }));
    return;
  }

  try {
    const [{ mkdir, appendFile }, path, { getAuditLogPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("./config.js")
    ]);
    const filePath = getAuditLogPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    console.warn("Failed to append finance MCP audit log; writing record to console instead.");
    console.log(
      JSON.stringify({
        type: "finance_mcp_audit",
        auditLogError: error instanceof Error ? error.message : String(error),
        ...payload
      })
    );
  }
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && typeof process.versions?.node === "string";
}
