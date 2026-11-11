import type { IAuthenticateGeneric, Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

const TOKENS_PAGE_URL = 'https://app.estactics.com/dashboard/account/tokens';

const SETUP_STEPS = [
	'<b>How to get your Estactics API token</b>',
	`1. In Estactics, open <a href="${TOKENS_PAGE_URL}" target="_blank">Account &gt; Tokens</a> and click <b>New token</b>.`,
	'2. Name it (e.g. "n8n") and choose the expiration: <b>No expiration</b>, or a specific period (when it expires, update this credential with a new token). Click <b>Next</b>.',
	'3. Copy the token (it starts with <code>atsec_</code>) and keep it, it is shown only once.',
	'4. Click <b>Edit permissions</b>, enable <b>Clients → Manage</b> and <b>Marketing Campaigns → View</b>, then click <b>Save</b>.',
	'5. Paste the token below and click <b>Save</b>.',
	'Tip: create the token as the organization owner or an admin, so leads can be created in every campaign.',
].join('<br>');

export class EstacticsApi implements ICredentialType {
	name = 'estacticsApi';

	displayName = 'Estactics API';

	icon: Icon = { light: 'file:../icons/estactics.svg', dark: 'file:../icons/estactics.dark.svg' };

	documentationUrl = 'https://github.com/Innventix-LTD/n8n-nodes-estactics#credentials';

	properties: INodeProperties[] = [
		{
			displayName: SETUP_STEPS,
			name: 'setupSteps',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'atsec_...',
			description: 'The Estactics API token, with the Clients → Manage and Marketing Campaigns → View permissions',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://backend.estactics.com',
			description: 'The Estactics API address. Keep the default unless Estactics support asks you to change it.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	// INFO: Lists one campaign, so a token missing the "Marketing Campaigns → View" permission fails here instead of on the first lead.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{($credentials.baseUrl || "https://backend.estactics.com").replace(/\\/+$/, "")}}/api',
			url: '/marketingCampaigns/search',
			method: 'POST',
			body: { fields: ['id'], limit: 1 },
			json: true,
		},
	};
}
