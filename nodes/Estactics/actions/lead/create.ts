import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { countryCodeOptions, countryOptions, languageOptions } from '../../shared/choices';
import type { RegistrationFormAnswer } from '../../shared/leadBody';
import { buildLead, getLeadDataError, parseCustomFields } from '../../shared/leadBody';
import { estacticsRequest } from '../../shared/request';

const showForLeadCreate = { show: { resource: ['lead'], operation: ['create'] } };

// INFO: Same fields, help texts and request body as the Zapier Create Lead action (integrations/zapier/creates/lead.js).
export const leadCreateProperties: INodeProperties[] = [
	{
		displayName: 'Campaign',
		name: 'campaign',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The active Estactics campaign the lead registers to, it sets the lead brand and assignee',
		displayOptions: showForLeadCreate,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a campaign...',
				typeOptions: { searchListMethod: 'searchCampaigns', searchable: true },
			},
			{
				displayName: 'By Code',
				name: 'code',
				type: 'string',
				placeholder: 'e.g. MDHIRUFK8KEF',
				hint: 'The campaign code, shown on the campaign page in Estactics',
				validation: [
					{
						type: 'regex',
						properties: { regex: '^\\s*[A-Za-z0-9_-]+\\s*$', errorMessage: 'Enter a campaign code, e.g. MDHIRUFK8KEF' },
					},
				],
			},
		],
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showForLeadCreate,
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		displayOptions: showForLeadCreate,
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'name@email.com',
		displayOptions: showForLeadCreate,
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		required: true,
		description: 'Any format, e.g. +972 50-123-4567 or 050-1234567',
		displayOptions: showForLeadCreate,
	},
	{
		displayName: 'Registration Form',
		name: 'registrationForm',
		type: 'fixedCollection',
		placeholder: 'Add Answer',
		default: {},
		typeOptions: { multipleValues: true },
		description: 'Any other form answers (e.g. budget, rooms), shown on the lead registration in Estactics',
		displayOptions: showForLeadCreate,
		options: [
			{
				displayName: 'Answers',
				name: 'answers',
				values: [
					{
						displayName: 'Question',
						name: 'question',
						type: 'string',
						default: '',
						placeholder: 'e.g. Budget',
					},
					{
						displayName: 'Answer',
						name: 'answer',
						type: 'string',
						default: '',
						placeholder: 'e.g. 1,000,000',
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showForLeadCreate,
		options: [
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				default: '',
			},
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'options',
				options: countryOptions,
				default: '',
			},
			{
				displayName: 'Custom Fields (JSON)',
				name: 'customFields',
				type: 'json',
				default: '{}',
				description:
					'Advanced: a JSON object merged into the request, overriding the fields above. Accepts any field of the <a href="https://documenter.getpostman.com/view/44589795/2sB2qXjNGj" target="_blank">clients create API</a>, e.g. {"minBudget": 500000, "preferredCity": "Paphos"}.',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: languageOptions,
				default: '',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Saved as the client interest notes',
			},
			{
				displayName: 'Phone Default Country',
				name: 'phoneDefaultCountry',
				type: 'options',
				options: countryCodeOptions,
				default: '',
				description: 'Used for phones without a country prefix (e.g. 050-1234567). Defaults to the campaign country, then the organization country.',
			},
			{
				displayName: 'UTM Campaign',
				name: 'utmCampaign',
				type: 'string',
				default: '',
				description: 'The ad campaign name, e.g. map the Facebook campaign name',
			},
			{
				displayName: 'UTM Content',
				name: 'utmContent',
				type: 'string',
				default: '',
				description: 'The specific ad or creative that was clicked, e.g. map the Facebook ad name',
			},
			{
				displayName: 'UTM Medium',
				name: 'utmMedium',
				type: 'string',
				default: '',
				description: 'The marketing channel, e.g. paid_social, cpc, email',
			},
			{
				displayName: 'UTM Source',
				name: 'utmSource',
				type: 'string',
				default: '',
				description: 'Where the lead came from, e.g. facebook, instagram',
			},
			{
				displayName: 'UTM Term',
				name: 'utmTerm',
				type: 'string',
				default: '',
				description:
					'The keyword or audience that brought the lead, mostly used for search ads (e.g. luxury+villa+paphos). For Facebook you can map the ad set name.',
			},
		],
	},
];

/** Creates one lead. A returning person never fails (`throwErrorOnClientExists: false`), the organization duplicate behavior setting handles them. */
export async function createLead(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
	const lead = buildLead({
		campaignCode: this.getNodeParameter('campaign', itemIndex, '', { extractValue: true }),
		firstName: this.getNodeParameter('firstName', itemIndex, ''),
		lastName: this.getNodeParameter('lastName', itemIndex, ''),
		email: this.getNodeParameter('email', itemIndex, ''),
		phone: this.getNodeParameter('phone', itemIndex, ''),
		additionalFields,
		registrationForm: this.getNodeParameter('registrationForm.answers', itemIndex, []) as RegistrationFormAnswer[],
	});

	const parsedCustomFields = parseCustomFields(additionalFields.customFields);
	if ('error' in parsedCustomFields) throw new NodeOperationError(this.getNode(), parsedCustomFields.error, { itemIndex });

	// INFO: Custom fields override the mapped fields, technical users can send any field the clients create endpoint accepts.
	const body: IDataObject = { ...lead, ...parsedCustomFields.customFields, throwErrorOnClientExists: false };

	const leadDataError = getLeadDataError(body);
	if (leadDataError) {
		throw new NodeOperationError(this.getNode(), leadDataError, {
			itemIndex,
			description: 'Fix the lead data mapped into the Estactics node, or turn on "On Error → Continue" to skip such leads.',
		});
	}

	const { id } = ((await estacticsRequest.call(this, 'clients/create', body, { itemIndex })) ?? {}) as IDataObject;

	// INFO: The output is the exact body sent to Estactics, field by field and as a JSON string.
	return { ...body, id, requestBody: JSON.stringify(body, null, 2) };
}
