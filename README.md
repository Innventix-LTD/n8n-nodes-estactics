# Estactics n8n node

An [n8n](https://n8n.io) community node that creates leads in [Estactics](https://www.estactics.com), the real estate CRM, from any n8n workflow. For example: Facebook Lead Ads → Estactics, a website form → Estactics, or an AI agent that adds leads.

It works the same as the Estactics Zapier and Make apps: same connection steps, fields, request body, output and error messages.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Example workflows](#example-workflows)
- [Keep every lead](#keep-every-lead)
- [Other Estactics endpoints](#other-estactics-endpoints)
- [Compatibility](#compatibility)
- [Development](#development)

## Installation

**n8n Cloud and self-hosted, verified node.** Open the nodes panel, search for **Estactics** and click **Install**. On n8n Cloud, the instance owner may need to turn on verified community nodes in the Cloud admin panel first.

**Self-hosted, from npm.** As the instance owner, open **Settings → Community nodes → Install**, enter `@estactics/n8n-nodes-estactics` and confirm. See the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for queue mode and Docker setups.

## Credentials

The node connects with an Estactics API token.

1. In Estactics, open [Account > Tokens](https://app.estactics.com/dashboard/account/tokens) and click **New token**.
2. Name it (e.g. "n8n") and choose the expiration: **No expiration**, or a specific period (when it expires, update the credential with a new token). Click **Next**.
3. Copy the token (it starts with `atsec_`) and keep it, it's shown only once.
4. Click **Edit permissions**, enable **Clients → Manage** and **Marketing Campaigns → View**, then click **Save**.
5. In n8n, create an **Estactics API** credential, paste the token in **API Token** and click **Save**.

n8n tests the credential by listing your campaigns, so a token missing a permission fails right away instead of on the first lead.

> Create the token as the organization owner or an admin, so leads can be created in every campaign.

Keep **Base URL** as `https://backend.estactics.com` unless Estactics support asks you to change it.

## Operations

### Lead → Create

Creates a new lead in Estactics under an active campaign. The campaign sets the lead brand and assignee.

| Field | Description |
| --- | --- |
| Campaign | Required. Choose from the list of active campaigns (searchable), or enter the campaign code. |
| First Name | Required. |
| Last Name | |
| Email | Required. |
| Phone | Required. Any format, e.g. `+972 50-123-4567` or `050-1234567`. |
| Registration Form | Any other form answers (e.g. budget, rooms), as question and answer pairs. Shown on the lead registration in Estactics. |
| **Additional Fields** | |
| Phone Default Country | Used for phones without a country prefix. Defaults to the campaign country, then the organization country. |
| Language, Country, City, Address | |
| Notes | Saved as the client interest notes. |
| UTM Source, Medium, Campaign, Term, Content | Where the lead came from, e.g. map the Facebook campaign, ad set and ad names. |
| Custom Fields (JSON) | Advanced: a JSON object merged into the request, overriding the fields above. Accepts any field of the [clients create API](https://documenter.getpostman.com/view/44589795/2sB2qXjNGj), e.g. `{"minBudget": 500000, "preferredCity": "Paphos"}`. Mapped values with special characters (backslashes, new lines) are repaired automatically. |

When the person already exists in Estactics (same email or phone), the node doesn't fail. Your organization's duplicate behavior setting decides what happens: do nothing, or add a lead registration to the existing client.

The output of every item is the data sent to Estactics, the new client `id` and `requestBody`, the exact request as JSON.

Every input item creates one lead. The node can also be used as a tool by the n8n **AI Agent**, e.g. a chat assistant that adds the leads it talks to.

## Example workflows

Import any of these from the [`examples`](./examples) folder (**Workflows → Import from file**), then pick your credentials and campaign:

| Workflow | What it does |
| --- | --- |
| [Facebook Lead Ads to Estactics](./examples/facebook-lead-ads-to-estactics.json) | Every new Facebook lead form submission becomes an Estactics lead. The full name is split, the other form answers go to the lead registration, and the form, ad set and ad names are saved as UTM fields. |
| [Website form to Estactics](./examples/website-form-webhook-to-estactics.json) | A webhook your website form posts to, the extra form answers go to the lead registration. |
| [HTTP Request fallback](./examples/http-request-fallback.json) | Creates a lead with the built-in HTTP Request node, for n8n instances where the Estactics node can't be installed. |

## Keep every lead

A failed lead fails its execution, and n8n saves failed executions by default. Fix the cause, then open **Executions**, select the failed execution and click **Retry**.

| Error | What to do |
| --- | --- |
| The plan clients limit is reached | Upgrade your Estactics plan, then retry the execution. |
| Invalid phone number, missing name, email or phone | Fix the mapping (or the lead data), then retry. To skip such leads and keep the others, set the node **Settings → On Error** to **Continue (using error output)** or **Continue**. |
| Missing permissions | Add the **Clients → Manage** and **Marketing Campaigns → View** permissions to the token, then retry. |
| Invalid token | The token was disabled, deleted or expired. Update the credential with a new token. |
| Campaign not found | The campaign was deleted or paused, choose another campaign in the node. |

Temporary errors (Estactics unavailable, too many requests, network errors) are retried by the node automatically, 3 times over about a minute.

To get an email or a Slack message when a lead fails, set an [error workflow](https://docs.n8n.io/flow-logic/error-handling/) in the workflow settings.

## Other Estactics endpoints

Use the built-in **HTTP Request** node with **Authentication → Predefined Credential Type → Estactics API** to call any endpoint of the [Estactics API](https://documenter.getpostman.com/view/44589795/2sB2qXjNGj) with your credential. Estactics API endpoints use `POST`, e.g. `https://backend.estactics.com/api/organizations/getMyOrganization`.

## Compatibility

Tested with n8n 2.x. Requires n8n 1.0 or later.

## Development

This package is built with the official [`@n8n/node-cli`](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/) in strict (n8n Cloud) mode, and has no runtime dependencies. Requires Node 22+.

```bash
npm install
npm run lint          # the n8n Cloud verification lint
npm test              # builds, then runs the tests against dist (node:test, mocked n8n context)
npm run dev           # starts n8n at http://localhost:5678 with this node linked, hot reload
```

`npm run sync-choices` refreshes the country and language options from the Estactics Zapier app (`../zapier/lib/choices.json`).

Maintainers: see [MAINTAINING.md](./MAINTAINING.md) for the release process.

## License

[MIT](./LICENSE)
