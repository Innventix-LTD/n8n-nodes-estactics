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
4. If npm staged the version instead of publishing it (the registry shows no new version, see [npm](#npm)), approve it.
5. Check the release: `npx @n8n/scan-community-package @estactics/n8n-nodes-estactics` must pass.

A push to `prod` without a version bump only updates the public code, nothing is published.

### Changing the public repository workflows

GitHub refuses a deploy key push that adds or changes `.github/workflows` files, so the mirror workflow fails when a commit
changes `integrations/n8n/.github/workflows`. After merging such a change to `prod`, push the mirror once with your own GitHub
login (SSH), from the Estactics repository:

```bash
git fetch origin prod
git push git@github.com:Innventix-LTD/n8n-nodes-estactics.git "$(git subtree split --prefix=integrations/n8n origin/prod):refs/heads/main"
```

`git subtree split` gives the same commits as the mirror workflow, so its later pushes continue from there. If the change came
with a version bump, also push the tag: replace `refs/heads/main` with `refs/tags/<version>`.

### npm

- Publishing uses the `NPM_TOKEN` secret of the public repository: a Granular Access Token with **Read and write** on the
  **`@estactics` scope** (selected under "Only select packages and scopes", a new package can't be selected by name).
  A token without that scope gets a 404 on publish, a token that can't bypass 2FA gets `EOTP`.
- npm may stage the version instead of publishing it ([staged publishing](https://docs.npmjs.com/cli/commands/npm-stage)):
  the publish job succeeds but the version isn't installable (a brand new package shows only `0.0.0-stage`). Approve it with
  npm 11.15 or later (Node 22.14+), as an `estactics` org owner with 2FA:

  ```bash
  npm login
  npm stage list @estactics/n8n-nodes-estactics
  npm stage approve <stage-id>   # asks for the 2FA code, then publishes
  ```

- Recommended next step: package settings → **Trusted Publishers** → GitHub Actions, owner `Innventix-LTD`, repository
  `n8n-nodes-estactics`, workflow `publish.yml`, then delete the `NPM_TOKEN` secret and the token. `publish.yml` already
  has the `id-token: write` permission it needs.

## Setup (done on 2026-11-11)

1. **Public repository** `Innventix-LTD/n8n-nodes-estactics`, created empty (no README or license, the mirror brings them).
2. **Deploy key** "estactics mirror (integrations/n8n)" with write access on the public repository, its private key is the
   `N8N_MIRROR_DEPLOY_KEY` secret of the Estactics repository. Deploy keys must be allowed in the Innventix-LTD organization settings.
   To replace it: `ssh-keygen -t ed25519 -f n8n-mirror -N ""`, add `n8n-mirror.pub` as a deploy key with write access, update the
   secret with `n8n-mirror`, delete the old key and both local files.
3. **npm** organization `estactics` and the `NPM_TOKEN` secret (see [npm](#npm)).
4. **First release** 1.0.0: pushed by hand (it adds the workflow files, see above), published, staged version approved.

## n8n verification

1. Check the published package: `npx @n8n/scan-community-package @estactics/n8n-nodes-estactics` (1.0.0 passed all checks).
2. Submit it at [creators.n8n.io/nodes](https://creators.n8n.io/nodes). Review takes up to 4 weeks, n8n emails on progress.
3. Once verified, submit `examples/facebook-lead-ads-to-estactics.json` to the n8n template library from the creator portal.

Verification rules to keep: MIT license, no runtime dependencies, no environment variables or file access in the node code,
English only, `n8n.strict: true` with the default lint config. See the
[verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/).

## Keep in sync with the Zapier and Make apps

The node mirrors the Zapier app (`integrations/zapier`): same fields, request body, output and error messages. When the Zapier
Create Lead action changes, update `nodes/Estactics/actions/lead/create.ts` and `nodes/Estactics/shared`. Country and language
options come from `../zapier/lib/choices.json` with `npm run sync-choices`, a test fails when they're out of sync.
