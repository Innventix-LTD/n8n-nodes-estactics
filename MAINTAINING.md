# Maintaining the Estactics n8n node

The source of truth is `integrations/n8n` in the Estactics repository (private). The public repository
[Innventix-LTD/n8n-nodes-estactics](https://github.com/Innventix-LTD/n8n-nodes-estactics) is a mirror of that folder, made by the
`.github/workflows/n8n-mirror.yml` workflow of the Estactics repository on every push to `prod` that changes the folder.
Don't commit to the public repository directly, the next mirror push would fail.

Why a mirror: n8n Cloud only offers verified community nodes, and n8n verifies only packages published to npm with
provenance from GitHub Actions in a public repository.

## Release

1. Bump `version` in `package.json` (semver) and add the changes to `CHANGELOG.md`.
2. `npm install` (updates `package-lock.json`), `npm run lint`, `npm test`.
3. Merge to `prod`. The mirror workflow pushes the code and the tag (e.g. `1.0.1`), the public repository `publish.yml`
   workflow lints, tests, builds and publishes to npm with provenance.
4. Check the release: `npx @n8n/scan-community-package @estactics/n8n-nodes-estactics` must pass.

A push to `prod` without a version bump only updates the public code, nothing is published.

## One-time setup

1. **Public repository**: create `Innventix-LTD/n8n-nodes-estactics` (public, empty, no README).
2. **Deploy key**: `ssh-keygen -t ed25519 -f n8n-mirror -N "" -C "n8n mirror"`.
   - Public repository → Settings → Deploy keys → Add `n8n-mirror.pub`, **Allow write access**.
   - Estactics repository → Settings → Secrets and variables → Actions → New secret `N8N_MIRROR_DEPLOY_KEY` = the content of `n8n-mirror`.
   - Delete both local files.
3. **npm**: create the `estactics` organization on npmjs.com. The first version of a package can't use a Trusted Publisher, publish it with a
   token: create a Granular Access Token (read and write, the `estactics` scope) and add it as the `NPM_TOKEN` secret of the public repository.
   After the first publish: package settings → Publishing access → **Trusted Publishers** → GitHub Actions, owner `Innventix-LTD`,
   repository `n8n-nodes-estactics`, workflow `publish.yml`. Then delete the `NPM_TOKEN` secret and the token.
4. **First release**: run the mirror workflow (Actions → n8n node mirror → Run workflow on `prod`).

## n8n verification

1. Check the published package: `npx @n8n/scan-community-package @estactics/n8n-nodes-estactics`.
2. Submit it at [creators.n8n.io/nodes](https://creators.n8n.io/nodes). Review takes up to 4 weeks, n8n emails on progress.
3. Once verified, submit `examples/facebook-lead-ads-to-estactics.json` to the n8n template library from the creator portal.

Verification rules to keep: MIT license, no runtime dependencies, no environment variables or file access in the node code,
English only, `n8n.strict: true` with the default lint config. See the
[verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/).

## Keep in sync with the Zapier and Make apps

The node mirrors the Zapier app (`integrations/zapier`): same fields, request body, output and error messages. When the Zapier
Create Lead action changes, update `nodes/Estactics/actions/lead/create.ts` and `nodes/Estactics/shared`. Country and language
options come from `../zapier/lib/choices.json` with `npm run sync-choices`, a test fails when they're out of sync.
