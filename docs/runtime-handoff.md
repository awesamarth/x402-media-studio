# Normal downloader runtime handoff

> Historical runtime record. YouTube support and the home proxy have since been removed. Do not reactivate platform imports; see [current URL support](url-import.md). The generic fixture runner and rootless Docker installation are retained.

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

## Resolved approval and verified runtime

The user explicitly approved the exact path-scoped RootlessKit `flags=(unconfined)` userns exception after its effect was explained. A single retried application succeeded. Profile: /etc/apparmor.d/media-rootlesskit, attached only to /home/ubuntu/bin/rootlesskit. Global namespace restriction remains 1. Rootless Docker user service is active and enabled, with lingering already enabled. No rootful daemon/socket or Docker group grant was added.

Daemon configuration disables iptables, ip6tables and bridge management. Docker reports rootless, builtin seccomp and cgroupns, cgroup v2, and memory/PID/CPU quota support. The checksum-verified image is loaded; Docker reports image ID sha256:140d8ddd1d762b402969fc24a11849a416a08c67926754936a2cc23dd5f9a828. A network-none restricted container confirmed Node24.18.0, yt-dlp2026.08.19 and an empty route table.

The real imports.download CLI branch retrieved the official 352078-byte public speech fixture through the isolated Linux container and enforcing relay in 3986 ms. A second run under a transient unit with User=ubuntu, PrivateTmp=yes, NoNewPrivileges=yes, ProtectSystem=strict and the same writable service data directory succeeded in 3675 ms. The probe used an encoded-dot URL for the same unrestricted fixture to exercise yt-dlp rather than the direct-file shortcut. This verifies native runner acquisition, not platform extraction or YouTube access. Temporary job directories and containers were removed by the existing cleanup path.

The media service now has DOCKER_BIN=/home/ubuntu/bin/docker, DOCKER_HOST=unix:///run/user/1001/docker.sock and IMPORT_RUNNER_ROOTLESS=1. Its PrivateTmp, NoNewPrivileges and ProtectSystem protections remain. Caddy and Media Studio are active, public health stays paid, and Flappy Bird returns HTTP200.

## Remaining owner boundary

YouTube-specific configuration and platform activation are deliberately unchanged for the user's other agent. Public health still reports videoPlatforms=false. No proxy/evasion hooks, cookies, alternate clients or routing changes were introduced. Prior Oracle YouTube sign-in/bot-check remains unresolved. Normal rootless runtime is ready; do not misreport that as verified platform extraction.
