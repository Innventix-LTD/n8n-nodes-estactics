import type { IAuthenticateGeneric, Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

const TOKENS_PAGE_URL = 'https://app.estactics.com/dashboard/account/tokens';

// INFO: n8n shows credential notices as one paragraph (line breaks and bold are removed, links are kept), so the steps are sentences.
const SETUP_STEPS = [
	`Create the token in Estactics under <a href="${TOKENS_PAGE_URL}" target="_blank">Account &gt; Tokens</a>: click New token, name it (e.g. "n8n") and copy it, it starts with atsec_ and is shown only once.`,
	'Then click Edit permissions and enable Clients → Manage and Marketing Campaigns → View.',
	'Create it as the organization owner or an admin, so leads can be created in every campaign.',
].join(' ');

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
