import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { x402OutputSchema } from "./paybox.js";

import { api, purchaseProposal, quoteSchema, result } from "./client.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const output = z.object({ data: z.json() }).strict();
const steps = z.array(z.object({
  type: z.enum(["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"]),
}).catchall(z.json())).min(1).max(12);
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

function createServer() {
  const server = new McpServer({ name: "x402-media-studio", version: "0.1.0" }, { supportedProtocolVersions: ["2026-07-28"] });
  server.registerTool("inspect_asset", {
    title: "Inspect media asset", description: "Inspect an uploaded asset. Omit assetId to see setup requirements. Upload media directly to the API before using this plugin.",
    inputSchema: z.object({ assetId: id.optional() }).strict(), outputSchema: output, annotations,
  }, async ({ assetId }) => result(assetId ? await api(`/assets/${assetId}`) : { service: "x402-media-studio", apiConfigured: Boolean(process.env.MEDIA_API_URL), payment: "Disabled until backend recipient and facilitator are configured", upload: "Upload raw media directly to POST /assets; use the returned asset ID.", stepTypes: ["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"] }));
  server.registerTool("quote_workflow", {
    title: "Quote a media workflow", description: "Get a quote for an ordered workflow. Provider-dependent steps may be unavailable. Does not pay or enqueue work.",
    inputSchema: z.object({ assetId: id, steps }).strict(), outputSchema: output, annotations: { ...annotations, readOnlyHint: false },
  }, async (workflow) => result(await api("/quotes", workflow)));
  server.registerTool("purchase_workflow", {
    title: "Prepare workflow payment", description: "Prepare an unsigned x402 payment proposal for a quote. PayBox obtains approval and sends payment. Poll the PayBox request until terminal, extract job ID from service response, then call get_job. Never repurchase an uncertain payment.",
    inputSchema: z.object({ quoteId: id, idempotencyKey: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict(), outputSchema: x402OutputSchema, annotations,
  }, async ({ quoteId, idempotencyKey }) => purchaseProposal(quoteSchema.parse(await api(`/quotes/${quoteId}`)), idempotencyKey));
  server.registerTool("get_job", {
    title: "Get workflow job", description: "Read job status and artifact URLs after the paid service returns a job ID. Download large media artifacts outside the plugin.",
    inputSchema: z.object({ jobId: id }).strict(), outputSchema: output, annotations,
  }, async ({ jobId }) => result(await api(`/jobs/${jobId}`)));
  return server;
}
serveStdio(createServer, { legacy: "reject" });
