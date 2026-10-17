# Local verification evidence

Environment: macOS ARM64, Bun 1.3.14. Default `node` is `/usr/local/bin/node`, v22.17.0. Running `node scripts/conformance.mjs` inside `adapter/` fails as expected with `environment_invalid`; Node 22 is not an official conformance pass.

The existing Node 24 installation is `/Users/awesamarth/.nvm/versions/node/v24.12.0/bin/node`. Exact official-check command from `adapter/`:

```sh
PATH="/Users/awesamarth/.nvm/versions/node/v24.12.0/bin:$PATH" bun run test
```

This passes TypeScript, byte-identical double build and official starter 1.0.2 MCP conformance. The new bundle has five tools. See `adapter/conformance-report.json` for runtime, size and SHA256. The default sample remains setup-only inspect_asset; it is not evidence of backend connectivity.

Real bundled adapter/backend integration from project root:

```sh
NODE24_BIN=/Users/awesamarth/.nvm/versions/node/v24.12.0/bin/node bun scripts/adapter-integration.ts
```

This launches the actual bundled Node24 MCP process and actual loopback Bun API. A test-only fetch shim simulates the host broker by forwarding the configured illustrative HTTPS origin to loopback and injecting a fixed fixture bearer token. It successfully calls inspect_asset with real uploaded media, quote_workflow, get_job and read_artifact; the artifact contents are checked. This is not HTTPS certificate, PayBox hosted, secret-broker, or payment validation. No public network request occurs.

`bun test` and the integration command require loopback socket access. This environment's default sandbox denied sockets; these checks passed after explicit tool sandbox escalation for local tests. A sandbox-denied run is not a failed implementation test or a passing verification. Other execution environments may need equivalent loopback permission. `bun run typecheck` does not require socket access.

All payment tests use a loopback mock facilitator and fabricated signatures, with no wallet or chain calls. The test-only unbound-payment allowance is not enabled by the server. Real signatures, facilitator authentication, settlement finality and production customer binding remain unverified.
