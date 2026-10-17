# File retention

New jobs retain inputs and generated outputs for one hour after success or final failure. Jobs return `completedAt` and `expiresAt`; pending jobs return `expiresAt: null`. Unsubmitted uploads expire one hour after upload. Request access extends through the full completed-job download window, including recovery after a restart. Binary downloads include an `Expires` header; inline artifact responses include `expiresAt`.

Cleanup runs at API startup and on an actual 30-second timer. It waits while requests, workers or uploads are active, so physical removal happens on the next idle sweep after expiry. Artifact access ends at the deadline even if deletion is waiting. With a still-valid request, an expired artifact returns HTTP410; an expired request handle returns401. Active jobs are protected. Shared inputs and cache are retained until the last unexpired reference releases them; unresolved purchases without jobs retain their required input until reconciliation/fulfillment. An identical subsequent upload/reference can legitimately extend shared storage lifetime.

New input grants, jobs and cache manifests carry versioned retention timestamps. Crash leftovers created after policy activation are eligible after an hour. Restart preserves the activation boundary and expiry timestamps, resumes eligible interrupted jobs, and starts cleanup again. Legacy files are never silently enrolled into deletion. Small job tombstones, payment/replay records and ownership metadata can remain after media deletion to prevent repeated charging/execution; this is media retention, not total account/history deletion.

## Verification and deployment

TypeScript checking passed. Direct verification used real FFmpeg clips on disposable synthetic audio, an advanced sweep clock, and actual filesystem checks: expired outputs/failed partials/orphan uploads removed; active jobs and shared references protected; cache and input removed after the last expiry; dry-run and legacy preservation confirmed. A real local HTTP server exposed deadlines and rejected expired artifacts; its actual scheduled tick removed an expired output directory after approximately30 seconds. Fixture deadlines were advanced for verification; no claim of waiting a full wall-clock hour.

The policy is deployed on the existing VPS free API. A public-fixture clip completed at `2026-10-17T15:42:23.382Z` with expiry `2026-10-17T16:42:23.382Z`, exactly3600 seconds later. Free mode and paymentStatus `not_required` were verified; Flappy Bird remainedHTTPS200. No Caddy or network-policy changes were needed.

Samarth subsequently authorized clearing the identified old generated test outputs/cache. Exactly76 files (1350777 bytes) were removed from five old service job directories and twelve old cache directories. Their job records now report expired/cleared rather than advertising missing artifacts. Original inputs, source, models, logs, evidence reports and new managed jobs were preserved. Original legacy input files remain exempt from automatic deletion; new data is managed automatically. No broad repository output purge occurred.

See [verification evidence](retention-verification.json). The existing PayBox bundle remains compatible; backend responses add expiry fields without requiring a new upload. No payment, portal submission, or terms acceptance occurred.
