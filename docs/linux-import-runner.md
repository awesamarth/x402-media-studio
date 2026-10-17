# Linux ARM64 URL runner — preparation only

No VPS changes have been made. The backend runs on the Linux host and launches the dedicated downloader image. It does not run arbitrary client-selected commands or mount provider credentials. The host owns the enforcing CONNECT proxy; the downloader sees only its writable work directory and a read-only mount containing a Unix proxy socket. Docker `--network none` provides no external route. A small Python relay exposes the Unix socket at container loopback port 7777 for yt-dlp. There is no host TCP proxy port to expose or firewall rule to add.

The runner also uses a read-only root, drops all capabilities, enables no-new-privileges, sets 64 PIDs, 512 MiB RAM/no swap, one CPU, and a 32 MiB noexec temporary filesystem. It runs as the backend UID/GID. No Docker socket is mounted into the downloader. The trusted backend needs local Docker daemon permission; rootful Docker access is privileged operator authority. Use a local daemon whose bind paths refer to this same Linux filesystem; remote DOCKER_HOST deployments are unsupported. Missing image fails because runtime uses --pull never. The child has its own 175-second deadline in addition to the host timeout. Host crash closes the Unix proxy; the child deadline bounds leftover work.

## Commands after explicit VPS approval

Docker installation is a host/daemon change and may affect host firewall management. Do not execute this section while VPS work is on hold. If Docker is absent, approval must explicitly cover installing/enabling Docker on oracle-vps and granting the service account Docker access; choose rootless Docker or approved rootful operation before applying permissions. Do not add the current user to a Docker group silently.

For the Ubuntu distribution package option, reviewed commands would be:

```bash
sudo apt-get update
sudo apt-get install --no-install-recommends docker.io
sudo systemctl enable --now docker
```

Once an approved local Docker context and service account exist, from the project checkout:

```bash
docker build --platform linux/arm64 -t x402-media-importer:local deploy/importer
docker image inspect x402-media-importer:local --format '{{.Id}}'
# Backend also requires its documented Bun, FFmpeg and local AI setup.
bun run setup:local
BILLING_MODE=free IMPORT_RUNNER_IMAGE=x402-media-importer:local bun --env-file=.env.local src/server.ts
# Separate terminal; existing helper starts its own temporary loopback API:
bun run try:file -- 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav'
```

The default model is multilingual small (487,601,967 bytes, SHA256 1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b). Base is an explicit WHISPER_MODEL override only. No Caddy, DNS, public binding, payment or production activation is part of these commands. Actual service installation/domain selection remains a separate approval step.

## Validation and remaining gate

The image builds on the existing local ARM64 Linux Docker engine. An actual network-none container could not connect directly to 1.1.1.1:443, and the real relay passed a loopback TCP request to a Unix socket. The host proxy Unix listener and security policy have focused tests. The full public-download Linux path has not yet run on a native Linux host; Docker Desktop cannot validate a macOS-host Unix socket as if both endpoints shared a Linux kernel. Do the permitted public fixture on native Linux before enabling URL imports in a deployed service. This is an implemented deployment path with a remaining integration gate, not a claim of verified VPS operation.

Source scope remains narrow: direct upstream JFK WAV verified on macOS; YouTube page extraction unverified; W3 URLs unverified. Paid import remains disabled. The Python base image digest and yt-dlp version are pinned; Debian apt package versions are not fully reproducible. Record the resulting image digest after each approved build.

Docker references: [none network](https://docs.docker.com/engine/network/drivers/none/), [resource constraints](https://docs.docker.com/engine/containers/resource_constraints/).

## Current downloader wiring

The importer explicitly passes `--js-runtimes node:/usr/local/bin/node`. macOS can override the absolute executable path with `YT_DLP_JS_RUNTIME`. The prepared Linux image copies Node 24.18.0 from the official Node image and installs yt-dlp default dependencies (including matching EJS). Image tags pin versions, not immutable Node image bytes. The production VPS still has platform extraction disabled because the isolated Linux runner has not been provisioned; installing a host CLI alone does not enable that runner. Existing direct-file acquisition remains enabled. Prior ordinary YouTube retrieval from Oracle returned an explicit sign-in/bot-check even with Node configured; this is an access restriction, not proof of missing downloader code. No cookies, alternate clients, proxies for changing egress, or restriction bypass are provided.

Caption-only workflows already inspect metadata, select matching manual captions before automatic captions, then fall back to media plus Whisper only if no matching captions exist. Access denial and caption download errors stop without fallback. Duration, filesize, deadline, allowed-host proxy and no-network container bounds remain unchanged.

Readiness check: the updated ARM64 image built successfully on the existing local Docker engine. A network-none, read-only, capability-dropped container confirmed Node v24.18.0, yt-dlp 2026.08.19 and yt-dlp-ejs 0.8.0. Built image configuration SHA256: 507dd895ab15f059dd7959e38e711158e1a3ad6609fc275ff69d98711b1ba052. The resolved official Node base index was sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d. This verifies image construction/runtime, not production platform extraction or access to YouTube.
