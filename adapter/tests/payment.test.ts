import { test, expect } from "bun:test";
import { apiBase, purchaseProposal, quoteSchema } from "../src/client.js";

test("disabled payment never creates a proposal", () => {
  expect(() => purchaseProposal(quoteSchema.parse({ id: "quote_fixture", amountAtomic: "1000", paymentConfigured: false }), "fixture_key")).toThrow("not configured");
});
test("fixture proposal binds Base amount, quote, and idempotency without paying", () => {
  process.env.MEDIA_API_URL = "https://media.example.com";
  const result = purchaseProposal(quoteSchema.parse({ id: "quote_fixture", amountAtomic: "1000", paymentConfigured: true }), "fixture_key");
  const proposal = result.structuredContent["io.paybox/transactionProposal"];
  expect(proposal.chain).toBe("eip155:8453");
  expect(proposal.request).toEqual({ url: "https://media.example.com/workflows", method: "POST", body: { quoteId: "quote_fixture", idempotencyKey: "fixture_key" } });
  expect(proposal.payment.maxAmount).toBe("1000");
});
test("expired quotes and non HTTPS origins are refused", () => {
  expect(() => purchaseProposal(quoteSchema.parse({ id: "q", amountAtomic: "1", paymentConfigured: true, expiresAt: "2020-01-01T00:00:00Z" }), "fixture_key")).toThrow("expired");
  process.env.MEDIA_API_URL = "http://localhost:3000";
  expect(apiBase).toThrow("HTTPS");
  delete process.env.MEDIA_API_URL;
});
