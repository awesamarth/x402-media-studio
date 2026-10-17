import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { x402OutputSchema } from "./paybox.js";

import { api, purchaseProposal, quoteSchema, result } from "./client.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const handle=z.string().regex(/^[a-f0-9]{64}$/).optional();
const output = z.object({ data: z.json() }).strict();
const steps = z.array(z.object({
  type: z.enum(["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"]),
}).catchall(z.json())).min(1).max(8);
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

function createServer() {
  const server = new McpServer({ name: "x402-media-studio", version: "0.1.0" }, { supportedProtocolVersions: ["2026-07-28"] });
  server.registerTool("create_request", {
    title:"Start a media request",description:"Get an automatically issued private request handle for paid media access. No signup or API key. Keep the handle for subsequent data tools; never put it in a payment proposal URL or body. It expires after one hour. Does not pay or execute any media service.",
    inputSchema:z.object({}).strict(),outputSchema:output,annotations:{...annotations,readOnlyHint:false,idempotentHint:false},
  },async()=>result(await api('/requests',{})));
  server.registerTool("inspect_asset", {
    title: "Inspect media asset", description: "Inspect an uploaded asset. Omit assetId to see setup requirements. Upload media directly to the API before using this plugin.",
    inputSchema: z.object({ assetId: id.optional(),requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({ assetId,requestHandle }) => result(assetId ? await api(`/assets/${assetId}`,undefined,requestHandle) : { service: "x402-media-studio", apiConfigured: Boolean(process.env.MEDIA_API_URL), payment: "Disabled until backend recipient and facilitator are configured", upload:"Call create_request, then upload raw media to POST /assets with X-Request-Handle. Use the asset ID and same requestHandle. No developer-issued API key.", stepTypes: ["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"] }));
  server.registerTool("import_url", {
    title: "Import public media URL", description: "Quote a bounded public URL workflow in paid mode. Every service operation, including cached and caption-only results, requires payment when paid mode is enabled. Call purchase_workflow with the returned quote ID. Supports configured HTTPS hosts only; playlists, live streams, login and restriction bypass are unsupported. Audio defaults to English transcription, preferring matching manual then automatic source captions for caption-only workflows; JSON artifacts identify provenance. Video defaults to a frame manifest. Poll get_import, then get_job. Does not download media inside PayBox.",
    inputSchema: z.object({url:z.string().url().max(2048),media:z.enum(["audio","video"]),idempotencyKey:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),steps:steps.optional(),requestHandle:handle}).strict(),outputSchema:output,annotations:{...annotations,readOnlyHint:false},
  },async ({requestHandle,...request})=>result(await api("/imports",request,requestHandle)));
  server.registerTool("get_import", {
    title:"Get public media import",description:"Read the owned import status. When jobId appears, get_job provides processing status and artifacts.",
    inputSchema:z.object({importId:id,requestHandle:handle}).strict(),outputSchema:output,annotations,
  },async ({importId,requestHandle})=>result(await api(`/imports/${importId}`,undefined,requestHandle)));
  server.registerTool("quote_workflow", {
    title: "Quote a media workflow", description: "Get a quote for an ordered workflow. Provider-dependent steps may be unavailable. Does not pay or enqueue work.",
    inputSchema: z.object({ assetId: id.optional(),source:z.object({url:z.string().url().max(2048),media:z.enum(["audio","video"])}).strict().optional(), steps,requestHandle:handle }).strict(), outputSchema: output, annotations: { ...annotations, readOnlyHint: false },
  }, async ({requestHandle,...workflow}) => result(await api("/quotes", workflow,requestHandle)));
  server.registerTool("purchase_workflow", {
    title: "Prepare workflow payment", description: "Start a real authenticated job in free mode, or prepare an unsigned x402 payment proposal in paid mode. Free mode never creates a zero-value proposal. PayBox obtains approval and sends payment. Poll the PayBox request until terminal, call get_purchase with the original quote ID to retrieve the authenticated job ID, then call get_job. Never repurchase an uncertain payment.",
    inputSchema: z.object({ quoteId: id, idempotencyKey: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),requestHandle:handle }).strict(), outputSchema: x402OutputSchema.partial().extend({data:z.json().optional()}).strict(), annotations:{...annotations,readOnlyHint:false},
  }, async ({ quoteId, idempotencyKey,requestHandle }) => {const quote=quoteSchema.parse(await api(`/quotes/${quoteId}`,undefined,requestHandle));if(quote.paymentStatus==='settled')return result(z.json().parse(quote));return quote.mode==='free'?result(await api('/workflows',{quoteId,idempotencyKey},requestHandle)):purchaseProposal(quote,idempotencyKey)});
  server.registerTool("get_purchase", {
    title: "Get owned purchase status", description: "Read owned purchase status. For an already-settled purchase, safely resumes enqueue after capacity returns, even after quote expiry; never pays or settles again. Reports awaiting_capacity separately from enqueue_failed.",
    inputSchema: z.object({ quoteId: id,requestHandle:handle }).strict(), outputSchema: output, annotations:{...annotations,readOnlyHint:false},
  }, async ({quoteId,requestHandle}) => result(await api(`/quotes/${quoteId}`,undefined,requestHandle)));
  server.registerTool("get_job", {
    title: "Get workflow job", description: "Read owned job status and artifact paths after get_purchase returns a job ID. Download large media artifacts outside the plugin.",
    inputSchema: z.object({ jobId: id,requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({ jobId,requestHandle }) => result(await api(`/jobs/${jobId}`,undefined,requestHandle)));
  server.registerTool("read_artifact", {
    title: "Read a small workflow artifact", description: "Read an owned artifact up to 48 KiB as base64 with this request’s automatically issued handle. Larger media uses the authenticated downloadPath returned by get_job; never put bearer tokens in URLs.",
    inputSchema: z.object({ jobId: id, name: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({jobId,name,requestHandle}) => result(await api(`/jobs/${jobId}/artifacts/${name}?inline=base64`,undefined,requestHandle)));
  return server;
}
serveStdio(createServer, { legacy: "reject" });
