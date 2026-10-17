import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { x402OutputSchema } from "./paybox.js";

import { api, apiBase, purchaseProposal, quoteSchema, result } from "./client.js";

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
    title:"Start a media request",description:"Get an automatically issued private request handle for free or paid media access. No signup or API key. Present upload.pageUrl as a clickable Upload your video link. User chooses their local file on that page and returns to chat. Keep requestHandle private, then call get_request_asset to retrieve the uploaded file on this same request. No attachment transport or extra connector is required. Never put requestHandle in a payment proposal URL or body. Upload access starts with one hour; completed-job access lasts one hour after completion. Does not pay or execute any media service.",
    inputSchema:z.object({}).strict(),outputSchema:output,annotations:{...annotations,readOnlyHint:false,idempotentHint:false},
  },async()=>result(await api('/requests',{})));
  server.registerTool("get_request_asset", {
    title:"Check uploaded request file",description:"Poll the same request after the user opens upload.pageUrl and chooses their file. Keep requestHandle internally. On uploadStatus ready, use returned assetId with quote_workflow and the same handle. No payment or processing is started.",inputSchema:z.object({requestHandle:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),outputSchema:output,annotations,
  },async ({requestHandle})=>result(await api('/requests/current',undefined,requestHandle)));
  server.registerTool("inspect_asset", {
    title: "Inspect media asset", description: "Inspect an uploaded asset. Omit assetId to see setup requirements. Upload media directly to the API before using this plugin.",
    inputSchema: z.object({ assetId: id.optional(),requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({ assetId,requestHandle }) => result(assetId ? await api(`/assets/${assetId}`,undefined,requestHandle) : { service: "x402-media-studio", apiConfigured: true, health:await api("/health"), docs:new URL("/llms.txt",apiBase()).toString(), upload:"Call create_request, show its upload.pageUrl to the user, then get_request_asset after they upload. Use its assetId with quote_workflow on the same private request. Raw POST /assets also remains available to agents with actual bytes and outbound HTTP capability. PayBox use_plugin takes JSON and does not document attachment-ID or native-file authorization forwarding. Never invent download URLs or claim the connector alone uploads ChatGPT attachments. Alternatively import_url supports configured direct media hosts. No second connector is required for the existing API workflow.", stepTypes: ["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"] }));
  server.registerTool("import_url", {
    title: "Import public media URL", description: "Quote a bounded public URL workflow in the current API mode. When paid mode is enabled, one server-quoted total covers the workflow, including import, multiple steps, cached and caption-only results. Quoting itself does not charge. Call purchase_workflow with the returned quote ID. Supports configured HTTPS hosts only; playlists, live streams, login and restriction bypass are unsupported. Audio defaults to English transcription, preferring matching manual then automatic source captions for caption-only workflows; JSON artifacts identify provenance. Video defaults to a frame manifest. Use the returned quote ID with purchase_workflow, then get_purchase and get_job. Does not download media inside PayBox.",
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
    title: "Prepare workflow payment", description: "Start a real authenticated job in free mode, or prepare an unsigned x402 proposal using the backend quote total in paid mode. Quotes, status and artifact reads do not separately charge. Free mode and zero-total quotes start authenticated jobs without a payment proposal. Clipping from a validated YouTube source URL or server-verified YouTube asset is free; other operations keep the quoted tariff. PayBox obtains approval and sends payment. Poll the PayBox request until terminal, call get_purchase with the original quote ID to retrieve the authenticated job ID, then call get_job. Never repurchase an uncertain payment.",
    inputSchema: z.object({ quoteId: id, idempotencyKey: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),requestHandle:handle }).strict(), outputSchema: x402OutputSchema.partial().extend({data:z.json().optional()}).strict(), annotations:{...annotations,readOnlyHint:false},
  }, async ({ quoteId, idempotencyKey,requestHandle }) => {const quote=quoteSchema.parse(await api(`/quotes/${quoteId}`,undefined,requestHandle));if(quote.paymentStatus==='settled')return result(z.json().parse(quote));return quote.mode==='free'||quote.amountAtomic==='0'?result(await api('/workflows',{quoteId,idempotencyKey},requestHandle)):purchaseProposal(quote,idempotencyKey)});
  server.registerTool("get_purchase", {
    title: "Get owned purchase status", description: "Read owned purchase status. For an already-settled purchase, safely resumes enqueue after capacity returns, even after quote expiry; never pays or settles again. Reports awaiting_capacity separately from enqueue_failed.",
    inputSchema: z.object({ quoteId: id,requestHandle:handle }).strict(), outputSchema: output, annotations:{...annotations,readOnlyHint:false},
  }, async ({quoteId,requestHandle}) => result(await api(`/quotes/${quoteId}`,undefined,requestHandle)));
  server.registerTool("get_job", {
    title: "Get workflow job", description: "Read owned job status and artifact paths after get_purchase returns a job ID. For succeeded jobs, artifacts include filename, mimeType, downloadUrl and downloadExpiresAt. Present each downloadUrl as a Markdown link labeled with its filename so the user can click/download without request headers. Links grant read access only to that artifact for at most 15 minutes and never beyond file expiry; keep them private. Poll get_job again to refresh expired links while files remain available.",
    inputSchema: z.object({ jobId: id,requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({ jobId,requestHandle }) => result(await api(`/jobs/${jobId}`,undefined,requestHandle)));
  server.registerTool("read_artifact", {
    title: "Read a small workflow artifact", description: "Read an owned artifact up to 48 KiB as base64 with this request’s automatically issued handle. For clickable downloads of any size use get_job artifact.downloadUrl (a short-lived single-artifact capability). Never put the private requestHandle in a URL.",
    inputSchema: z.object({ jobId: id, name: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({jobId,name,requestHandle}) => result(await api(`/jobs/${jobId}/artifacts/${name}?inline=base64`,undefined,requestHandle)));
  return server;
}
serveStdio(createServer, { legacy: "reject" });
