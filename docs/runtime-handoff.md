# Normal downloader runtime handoff

This handoff covers the normal isolated runtime only. YouTube-specific work is owned separately; do not modify its extraction settings or introduce cookies, alternate clients or routing bypasses here.

## Completed

- Official Docker 29.9.1 binaries: /home/ubuntu/bin (VPS uid 1001).
- Installed Ubuntu uidmap and slirp4netns; subordinate UID/GID allocation already existed.
- Approved user lingering enabled.
- Global kernel.apparmor_restrict_unprivileged_userns remains 1. Existing Caddy and Media Studio services remain active, with PrivateTmp=yes, NoNewPrivileges=yes and ProtectSystem=strict.
- ARM64 importer image built and version-checked locally: Node24.18.0, yt-dlp2026.08.19, EJS0.8.0. Image configuration SHA256 507dd895ab15f059dd7959e38e711158e1a3ad6609fc275ff69d98711b1ba052.
- Image archive staged at /home/ubuntu/x402-media-studio/.runtime/importer-arm64.tar; archive SHA256 1eba7d7c7de73c80c02bee0336ecfcebed4ef881295dbf01263e309f2851895f. Verify it before loading.
- src/import-runner.ts explicitly selects the rootless local Unix socket and maps container UID0 to the daemon's unprivileged host owner. Existing network-none, read-only, capability-drop, no-new-privileges and resource limits remain.
- src/imports.ts stages the Linux proxy socket under the job directory rather than private /tmp, so the user daemon can bind mount it. CLI extraction/captions selection interfaces are unchanged.

## Exact pending gate

Automatic approval review rejected Docker's official path-scoped `flags=(unconfined)` RootlessKit profile as broader than the previous approval. No profile was applied. The parent has requested exact action-time approval. Do not apply it, use --force, change the global namespace policy, or introduce an equivalent workaround before that answer. Docker user daemon remains inactive.

## Once that gate is legitimately resolved

Use the reviewed official Docker rootless setup helper in /home/ubuntu/bin. Keep daemon firewall/bridge management disabled with the reviewed deploy/importer/rootless/daemon.json configuration. Start/enable the user daemon, inspect docker info for rootless + cgroupv2 and resource controls, load the checksum-verified staged image via the per-user Unix socket, then validate native Linux socket/relay acquisition before activation. Never expose a Docker TCP API or mount the Docker socket into the downloader.

The prepared environment.example contains only non-secret normal runtime settings. Do not enable URL_IMPORTS_ENABLED until the native isolated runner actually passes. Direct-file HTTP acquisition is independently verified and remains active. A generic direct WAV check is not evidence of platform extraction; report the distinction. Prior Oracle YouTube sign-in/bot-check remains unresolved.
