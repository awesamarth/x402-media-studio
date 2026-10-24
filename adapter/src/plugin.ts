import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { x402OutputSchema } from "./paybox.js";

import { api, apiBase, purchaseProposal, quoteSchema, result } from "./client.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const requestHandle=z.string().regex(/^[a-f0-9]{64}$/).describe('Scoped upload-session handle returned by create_request. It identifies this request and is sent only in the X-Request-Handle header to the same Media Studio API. Keep it private; it is not a wallet credential or payment approval.');
const handle=requestHandle.optional();
const output = z.object({ data: z.json() }).strict();
const subtitleOptions=z.object({format:z.enum(['srt','vtt']).optional(),overlap:z.enum(['error','trim','preserve']).optional(),sort:z.boolean().optional(),maxChars:z.number().int().min(10).max(100).optional(),maxLines:z.number().int().min(1).max(5).optional()}).strict();
const steps=z.array(z.discriminatedUnion('type',[
  z.object({type:z.literal('transcribe'),language:z.enum(['en','auto']).optional()}).strict(),
  z.object({type:z.literal('localize'),from:z.literal('en').optional(),to:z.literal('es').optional(),text:z.string().max(100000).optional(),options:subtitleOptions.optional()}).strict(),
  z.object({type:z.literal('clip'),start:z.number().min(0),duration:z.number().positive().max(600)}).strict(),
  z.object({type:z.literal('frames'),atSeconds:z.array(z.number().min(0)).min(1).max(12).optional(),ocr:z.boolean().optional()}).strict(),
  z.object({type:z.literal('repair_subtitles'),text:z.string().max(100000).optional(),options:subtitleOptions.optional()}).strict(),
  z.object({type:z.literal('convert'),targetBytes:z.number().int().min(100000).max(100000000).optional()}).strict(),
  z.object({type:z.literal('normalize')}).strict(),
])).min(1).max(8);
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

function createServer() {
  const server = new McpServer({ name: "x402-media-studio", version: "0.1.0" }, { supportedProtocolVersions: ["2026-07-28"] });
  server.registerTool("create_request", {
    title:"Start a media request",description:"Get an automatically issued private request handle for free or paid media access. No signup or API key. Present upload.pageUrl as a clickable Upload your video link. User chooses their local file on that page and returns to chat. Keep requestHandle private, then call get_request_asset to retrieve the uploaded file on this same request. No attachment transport or extra connector is required. Never put requestHandle in a payment proposal URL or body. Upload access starts with one hour; completed-job access lasts one hour after completion. Does not pay or execute any media service.",
    inputSchema:z.object({}).strict(),outputSchema:output,annotations:{...annotations,readOnlyHint:false,idempotentHint:false},
  },async()=>result(await api('/requests',{})));
  server.registerTool("get_request_asset", {
    title:"Check uploaded request file",description:"Poll the same request after the user opens upload.pageUrl and chooses their file. Keep requestHandle internally. On uploadStatus ready, use returned assetId with quote_workflow and the same handle. No payment or processing is started.",inputSchema:z.object({requestHandle}).strict(),outputSchema:output,annotations,
  },async ({requestHandle})=>result(await api('/requests/current',undefined,requestHandle)));
  server.registerTool("inspect_asset", {
    title: "Inspect media asset", description: "Inspect an uploaded asset. Omit assetId to see setup requirements. Upload media directly to the API before using this plugin.",
    inputSchema: z.object({ assetId: id.optional(),requestHandle:handle }).strict(), outputSchema: output, annotations,
  }, async ({ assetId,requestHandle }) => result(assetId ? await api(`/assets/${assetId}`,undefined,requestHandle) : { service: "x402-media-studio", apiConfigured: true, health:await api("/health"), docs:new URL("/llms.txt",apiBase()).toString(), upload:"Call create_request, show its upload.pageUrl to the user, then get_request_asset after they upload. Use its assetId with quote_workflow on the same private request. Raw POST /assets also remains available to agents with actual bytes and outbound HTTP capability. PayBox use_plugin takes JSON and does not document attachment-ID or native-file authorization forwarding. Never invent download URLs or claim the connector alone uploads ChatGPT attachments. Alternatively import_url supports configured direct media hosts. No second connector is required for the existing API workflow.", stepTypes: ["transcribe", "localize", "clip", "frames", "repair_subtitles", "convert", "normalize"] }));
  server.registerTool("import_url", {
    title: "Import public media URL", description: "Quote a bounded public URL workflow in the current API mode. When paid mode is enabled, the server sums 0.01 USDC per billable workflow step into one payment; imports have no separate surcharge and multiple artifacts from a step do not add charges. Quoting itself does not charge. Call purchase_workflow with the returned quote ID. Supports direct HTTPS media files on raw.githubusercontent.com and media.w3.org only. YouTube URLs and other video-platform imports are not supported; ask the user to upload their local file using create_request. Audio defaults to English transcription. Video defaults to a frame manifest. Use the returned quote ID with purchase_workflow, then get_purchase and get_job. Does not download media inside PayBox.",
    inputSchema: z.object({url:z.string().url().max(2048),media:z.enum(["audio","video"]),idempotencyKey:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),steps:steps.optional(),requestHandle:handle}).strict(),outputSchema:output,annotations:{...annotations,readOnlyHint:false},
  },async ({requestHandle,...request})=>result(await api("/imports",request,requestHandle)));
  server.registerTool("get_import", {
    title:"Get public media import",description:"Read the owned import status. When jobId appears, get_job provides processing status and artifacts.",
    inputSchema:z.object({importId:id,requestHandle:handle}).strict(),outputSchema:output,annotations,
  },async ({importId,requestHandle})=>result(await api(`/imports/${importId}`,undefined,requestHandle)));
  server.registerTool("quote_workflow", {
    title: "Quote a media workflow", description: "Create and save a price quote for media operations requested by the user on their selected uploaded file or supported source URL. Does not charge the user or start processing. Does not download source media or enqueue a job. Each billable step costs 0.01 USDC. Use from/to for localization, atSeconds for frame timestamps, and optional targetBytes only when an explicit output-size budget is wanted. Omit targetBytes for quality-focused H.264 CRF20 medium compression; audio is copied when AAC. Lossy encoding cannot guarantee identical quality or a smaller file. A larger encode may return the original MP4 with a compression report. Frame timestamps refer to the current media after earlier steps; sample original-time frames before clipping. Backend validation failures return an explicit error, not a quote.",
    inputSchema: z.object({ assetId: id.optional(),source:z.object({url:z.string().url().max(2048),media:z.enum(["audio","video"])}).strict().optional(), steps,requestHandle:handle }).strict(), outputSchema: output, annotations: { ...annotations, readOnlyHint: false, idempotentHint:false },
  }, async ({requestHandle,...workflow}) => {try{return result(await api('/quotes',workflow,requestHandle))}catch(error){return {...result({ok:false,error:{code:'quote_failed',message:error instanceof Error?error.message:'Quote request failed'},paymentStarted:false,processingStarted:false}),isError:true}}});
  server.registerTool("purchase_workflow", {
    title: "Prepare workflow payment", description: "Start a real authenticated job in free mode, or prepare an unsigned x402 proposal using the backend quote total in paid mode. Quotes, status and artifact reads do not separately charge. Free mode and zero-total quotes start authenticated jobs without a payment proposal. Each operation, including clipping, costs 0.01 USDC per workflow step in paid mode. YouTube URL imports are not supported. A frames step including OCR counts once, and all transcription formats together count once. Always use the stored quote total; previous quotes retain their original amount. PayBox obtains approval and sends payment. Poll the PayBox request until terminal, call get_purchase with the original quote ID to retrieve the authenticated job ID, then call get_job. Never repurchase an uncertain payment.",
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
