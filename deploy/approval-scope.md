# One approval bundle — not applied

Hostname: x402-media-studio.awesamarth.dev. Existing Flappy Bird and Caddy configuration are preserved; no other project/server is modified.

1. Create non-login system accounts x402-media (API/processing) and x402-media-fetch (network downloader), plus a shared work-only group. Install root-owned application files under /opt/x402-media-studio, runtime configuration under /etc/x402-media-studio/runtime.env, private API state under /var/lib/x402-media-studio. API owns its state; fetcher receives access only to per-job import-work directories and a dedicated Unix control socket, not API credentials or permanent artifacts. Proposed files: /etc/systemd/system/x402-media-studio.service, x402-media-fetch.service and x402-media-fetch.socket. Install/start/enable only these new units. Existing Caddy/Flappy Bird/Pebble services are not restarted for dependency setup.

2. Install any missing libnss-resolve prerequisite and a fetcher-only nsswitch/resolver configuration, retaining host-wide DNS. Apply systemd service-local kernel IP destination denies to the fetcher (private, loopback, link-local/metadata and reserved IPv4/IPv6 plus host-specific internal networks). No global firewall, SSH, routing, public IP or proxy changes. API talks to the fetcher over the dedicated Unix socket, so it needs no generic sudo/systemd-run access. Use ordinary installed yt-dlp arguments with normal native connections. Verify actual enforcement and permitted public caption retrieval before enabling this path; if unavailable, keep it disabled. Native systemd may accept filtering configuration without enforcing it, so acceptance alone is insufficient. This runner implementation/activation remains pending; no claim of readiness yet.

3. Create one ongoing API bearer credential in /etc/x402-media-studio/api.env (root-only 0600). It maps to account owner. The token is not printed or transmitted through chat. The API account gets no SSH/sudo login. User can generate the token on their own Mac and pipe it over SSH as described below. Approve credential installation/rotation separately if a token already exists; the installer refuses replacement.

4. After the user-created Cloudflare A record resolves to 80.225.204.42, back up /etc/caddy/Caddyfile to a dated root-only copy; append only the new site block from deploy/caddy/x402-media-studio.Caddyfile. Validate the combined configuration, then reload Caddy once. This publicly exposes the authenticated free-mode media API at the chosen HTTPS hostname and allows Caddy to obtain its certificate. Preserve the Flappy Bird block exactly; verify its response after reload. No DNS/account mutation by the agent is included.

5. Keep BILLING_MODE=free. No recipient/facilitator configuration, purchases, payment transactions, submission or public repository push.

Reviewable API service and Caddy drafts are included. Account/permission creation, privileged downloader configuration, ongoing credential installation, and public route activation have not been applied.

## Generate the token yourself without sending it in chat

After approving the bundle, run on your Mac in your own terminal:

```bash
umask 077
mkdir -p ~/.config/x402-media-studio
(set -o noclobber; openssl rand -hex 32 > ~/.config/x402-media-studio/api-token)
```

Do not paste the token in chat. Once deploy/install-api-token.py has been reviewed/transferred to the VPS and its installation is approved, stream the file over SSH:

```bash
ssh oracle-vps 'sudo -n python3 /home/ubuntu/x402-media-studio/deploy/install-api-token.py' < ~/.config/x402-media-studio/api-token
```

This reads the secret on stdin and writes a root-only service environment file; it never prints the token or puts it in a command argument/history. Keep the local file for your API client. The command is provided for user execution after approval, not executed by the agent during staging. If the private token file already exists, preserve it rather than overwriting; use a new filename only for an explicitly intended rotation.
