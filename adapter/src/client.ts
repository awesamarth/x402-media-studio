import * as z from "zod/v4";
import { proposeX402 } from "./paybox.js";
export function apiBase() {
  const value = process.env.MEDIA_API_URL;
  if (!value) throw new Error("Configure MEDIA_API_URL with the deployed media API HTTPS origin.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("MEDIA_API_URL must be an HTTPS origin on port 443 without credentials, query, or path.");
  }
  return url;
}
export async function api(path: string, body?: unknown) {
  const response = await fetch(new URL(path, apiBase()), {
    method: body === undefined ? "GET" : "POST", redirect: "error",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(6500),
  });
  const text = await response.text();
  if (Buffer.byteLength(text) > 1024 * 1024) throw new Error("API response exceeds 1 MiB; fetch artifact URLs outside this plugin.");
  if (!response.ok) throw new Error(`Media API returned HTTP ${response.status}. ${text.slice(0, 400)}`);
  return z.json().parse(JSON.parse(text));
}
export function result(data: z.infer<ReturnType<typeof z.json>>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { data } };
}
export const quoteSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), amountAtomic: z.string().regex(/^[1-9][0-9]{0,19}$/), paymentConfigured: z.boolean(), chain: z.enum(["eip155:8453", "solana:mainnet"]).default("eip155:8453"), expiresAt: z.string().optional() }).passthrough();
export function purchaseProposal(quote: z.infer<typeof quoteSchema>, idempotencyKey: string) {
  if (!quote.paymentConfigured) throw new Error("Payments are not configured on the media API. No payment proposal was created.");
  const expiry = Math.min(Date.now() + 240000, quote.expiresAt ? Date.parse(quote.expiresAt) : Infinity);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("Quote expired or has an invalid expiry; request a new quote.");
  return proposeX402({ chain: quote.chain, url: new URL("/workflows", apiBase()).toString(), method: "POST", body: { quoteId: quote.id, idempotencyKey }, maxAmount: quote.amountAtomic, expiresAt: new Date(Math.floor(expiry / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") });
}
