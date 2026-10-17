# Operation pricing

The approved price is **0.01 USDC per billable workflow step** (10,000 atomic units), summed into one workflow payment with integer arithmetic. There is no duration pricing.

- One billable step: 0.01 USDC.
- Transcribe → localize → clip → frames/OCR: 0.04 USDC for uploaded/non-YouTube media.
- The same four steps with a validated YouTube source: 0.03 USDC, because YouTube clipping is exempt.
- YouTube clipping alone: zero; authenticated execution without an x402 proposal.
- Transcription SRT/VTT/JSON files together count as one operation. A frames step including OCR counts as one operation.
- Uploads, quotes, status polls and downloads are free. Imports have no separate surcharge. Cache hits retain the quoted step price.

`src/pricing.ts` computes new quotes. Each quote stores its amount and pricing model. Payment challenges, authorization-value validation, settlement requirements and plugin proposals all use that saved amount. Existing quotes are never repriced by this change.

## Verification

The running VPS API returned quote/challenge amounts of 10000 for one operation, 40000 for four operations and 30000 for the mixed YouTube workflow. A YouTube clip-only quote returned zero with paymentRequired=false; the paid endpoint refused to create a zero-value challenge. All 13 pre-existing quote amounts remained unchanged. No source media was fetched, no job was started and no payment was made during these checks.

The adapter build and TypeScript checks passed. The rebuilt ten-tool bundle passed official conformance under Node 24.18.0; see `adapter/conformance-report.json` for its exact size and hash. The updated Desktop bundle must be uploaded to refresh portal tool descriptions; backend prices already apply to new quotes even through an older amount-driven adapter.

## Historical evidence

[Flat-price checks](flat-pricing-verification.json) describe the superseded 0.01-USDC-per-workflow tariff. [Facilitator evidence](live-facilitator-verification.json) describes earlier protocol verification. Successful paid workflows have subsequently been verified; this pricing change was checked with unpaid challenges only.
