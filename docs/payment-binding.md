# Payment binding blocker — production settlement refused

The standard exact EVM authorization signs payer, recipient, amount, validity and nonce. Our quote ID and workflow body are not signed by that authorization. An unsigned resource URL or additional JSON field does not solve this. Equal-priced quotes therefore cannot be distinguished by accepted payment requirements alone. In an isolated mock-facilitator fixture, application-level checking of an unbound authorization can accept quote A's payment against equal-price quote B on first use. Nonce replay prevention stops later reuse, not first-use substitution.

Production requests now refuse all payment-bearing execution with HTTP 503 before verify/settle. Quotes always advertise `paymentConfigured: false`, including when recipient/facilitator settings exist. The pending/settled state machine remains exercised through an explicit test-constructor option only; the server has no environment switch for that option. The unpaid challenge remains available for protocol testing with explicit fixture settings. No live payment has occurred.

Possible standards-compatible architecture choices to evaluate:

- Allocate a genuinely unique signed payment amount for every immutable quote (e.g. a disclosed atomic-USDC discriminator), with durable uniqueness and no unsafe reuse across authorization validity windows. This changes billing and needs a pricing decision; no such amount allocation is implemented.
- Use a quote-specific recipient controlled by the service. This changes receiving-wallet infrastructure and requires an explicit wallet/settlement design. It is not implemented.
- Use a standardized, supported signed binding extension if both PayBox and the chosen payment scheme support it. Support must be established first; we will not invent a custom field or imply that PayBox can sign it.

ACCOUNT_PAYER was introduced as a conservative single-wallet fixture constraint to prevent arbitrary payer/account substitution while the ownership design was incomplete. It is not the requested public customer product. It does not itself solve same-account equal-price quote substitution. Removing it alone would weaken ownership.

A dynamic customer design needs authenticated accounts, a verified wallet-to-account relationship (or another explicit account-claim design), immutable quote ownership and a cryptographically bound quote purchase. Verified facilitator payer evidence can identify the payer after authorization, but cannot by itself establish which account owns an unsigned quote. Status and artifact authorization must continue to check the account owner. Wallet enrollment, account authorization and pricing/binding choices remain morning architecture decisions; no account onboarding or wallet-signing flow has been fabricated.

Protocol reference: [official x402 v2 specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md). The application threat analysis above is our inference from the exact authorization fields and fixture behavior, not a claim that the protocol provides quote binding.
