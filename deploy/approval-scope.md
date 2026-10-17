# Simplified deployment scope

The earlier extra-account, shared-permission and permanent customer-token proposal is withdrawn and was never applied.

Use the existing nonroot ubuntu account and /home/ubuntu/x402-media-studio staging directory. No signup or developer-issued customer API key. Paid customers start POST /requests and automatically receive a private one-hour request handle; payment proposals contain no access secret. Free testing remains private/temporarily authenticated. No unbounded public free-compute route.

The remaining deployment actions are the ordinary app service under the existing account and adding the chosen Caddy host block after validation, preserving Flappy Bird. Required payment configuration is the user's public receiving address, Base USDC network, and a trusted facilitator URL; no actual payment is attempted without authorization.

The current protected URL downloader's native-network compatibility remains a specific gap. Do not remove its SSRF guard or make arbitrary network/security changes. No new service accounts, general sudo launchers, token files, global firewall, SSH, host-wide DNS or credential changes are included. If a required native destination boundary needs host permission, state that one narrow action before applying it.
