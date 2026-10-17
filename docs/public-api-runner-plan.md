# Public URL API: minimal native-CLI runner plan

## Current state

The ordinary installed yt-dlp CLI works locally: Stanford UF8uR6Z6KLc manual English captions, 244 cues, verified outputs under outputs/try-file/2026-10-17T12-46-29-489Z-e9682022/. The public URL endpoint currently uses the same subprocess CLI but adds an enforcing CONNECT relay. A minimal listing through that path got webpage HTTP429 and a bot-check warning while direct CLI succeeded; the exact lower-level cause is not proved. Do not call this a general YouTube block.

Server options are now aligned to normal CLI defaults: no custom extractor/client override, no forced native downloader, no JS/runtime/remote-component override. It retains ignore-config, single-video handling and resource bounds. Metadata uses skip-download/write-info-json with a 12 MiB file cap, rather than dumping potentially 4.4 MiB through a 2 MiB stdout cap. Warnings remain visible to bounded access-denial classification. The relay remains until a replacement is proved. These server option changes have only been type-checked; no extra external retrieval or automated test was run for them.

## Replacement boundary

Run each server-side yt-dlp invocation in its own Linux systemd system-service cgroup. The child uses the existing native network and resolver, with no HTTP proxy/client rewrites, cookie import or IP rotation. Apply standard IPAddressDeny rules to all child sockets, covering private/loopback/link-local/metadata/special-use IPv4 and IPv6 destinations. Kernel checks apply to the actual destination, including redirects and DNS changes. Keep the API/Caddy process outside that cgroup so denying downloader loopback does not break API traffic.

The existing CLI invocation, caption preference, queue, workflow and artifact model stay unchanged. A narrow privileged launcher would accept a validated job ID and fixed operation, read the owned job request, and start only the fixed installed CLI with generated arguments. It must not expose generic sudo systemd-run or accept arbitrary commands/options/paths from API clients. The downloader runs as an unprivileged service UID, with a clean temporary HOME/work directory, no capabilities, no-new-privileges, private temporary files, memory/PID/deadline limits and cgroup cleanup on timeout. No new site, domain or Caddy change is needed for runner validation.

Illustrative standard service properties, not an installed or validated unit:

```ini
[Service]
NoNewPrivileges=yes
CapabilityBoundingSet=
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
MemoryMax=512M
TasksMax=64
RuntimeMaxSec=180
IPAddressDeny=0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8
IPAddressDeny=169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16
IPAddressDeny=192.88.99.0/24 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/3
IPAddressDeny=::/128 ::1/128 ::ffff:0:0/96 64:ff9b::/96 64:ff9b:1::/48
IPAddressDeny=100::/64 2001::/32 2001:db8::/32 2002::/16 fc00::/7 fe80::/10 ff00::/8
```

The final policy must include host-specific internal/reserved networks and relevant local public addresses. It must not add localhost to IPAddressAllow, which takes precedence over denies and would reopen internal targets. This sample is a concrete review starting point, not a security certification or a claim that every possible network topology is covered.

## Exact blockers and approval scope

macOS sandbox-exec rejects CIDR destination predicates: a harmless compile-only check of remote ip 10.0.0.0/8 failed with “host must be * or localhost in network address”. Its current guard cannot simply be relaxed to native outbound traffic without losing private-network enforcement.

Read-only oracle-vps checks show systemd255.4 and cgroup2fs. Its version banner includes -BPF_FRAMEWORK; that alone does not determine legacy IPAddressDeny support, whose systemd255 implementation checks kernel capabilities at runtime. A native enforcement check is required: systemd may warn and continue without an effective IP firewall on unsupported systems. No public runner should be enabled merely because a unit accepted the directive.

The VPS has hosts: files dns and the systemd-resolved Unix socket, but /lib/aarch64-linux-gnu/libnss_resolve.so.2 was absent in the checked path. Denying private/loopback destinations would block the normal DNS stub. The scoped solution is an approved libnss-resolve installation if absent, with a downloader-only nsswitch/resolver bind override using the existing Unix resolver; do not change host-wide DNS or permit loopback IP traffic as a shortcut. Actual resolver behavior needs native confirmation.

Required explicit authorization, while VPS work is currently on hold: install any missing resolver prerequisite; install a dedicated downloader service/least-privilege job launcher; apply service-local cgroup IP filtering; run a public caption retrieval plus controlled private-destination enforcement checks on oracle-vps. Existing Caddy, Flappy Bird, Pebble, firewall rules outside that service, DNS/domains and production activation remain untouched. If enforcement cannot be confirmed, the runner stays disabled and no unrestricted fallback is permitted. No system service/filter/package has been installed or changed yet.

## Sources

[systemd IPAddressAllow/IPAddressDeny semantics](https://github.com/systemd/systemd/blob/main/man/systemd.resource-control.xml) and [systemd255 firewall capability handling](https://github.com/systemd/systemd/blob/v255/src/core/bpf-firewall.c). The documented allow-list precedes deny-list, and the source explicitly proceeds without filtering on unsupported kernels: both must be considered before activation.
