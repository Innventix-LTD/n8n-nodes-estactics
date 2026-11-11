import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { estacticsRequest } from '../shared/request';

export const CAMPAIGNS_PAGE_SIZE = 100;

interface Campaign {
	id: number;
	name?: string;
	campaignCode?: string | null;
}

// INFO: Text filters of the search API are case insensitive regular expressions, the typed text is matched literally.
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Active campaigns with a code (the code is what the lead is created with), searchable by name and paginated. Same request as the Zapier campaigns trigger. */
export async function searchCampaigns(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const offset = Number(paginationToken) || 0;
	const searchText = filter?.trim();
	const filters: IDataObject = { status: ['ACTIVE'] };
	if (searchText) filters.name = [escapeRegExp(searchText)];

	const campaigns = ((await estacticsRequest.call(
		this,
		'marketingCampaigns/search',
		{ fields: ['id', 'name', 'campaignCode'], filters, orderBy: { name: 'ASC' }, limit: CAMPAIGNS_PAGE_SIZE, offset },
		{ retry: false },
	)) ?? []) as Campaign[];

	const campaignsWithCode = campaigns.filter(({ campaignCode }) => campaignCode);
	// INFO: Campaigns can share a name, the code tells them apart in the list.
	const isNameRepeated = (name?: string) => campaignsWithCode.filter((campaign) => campaign.name === name).length > 1;

	return {
		results: campaignsWithCode.map(({ name, campaignCode }) => ({
			name: !name ? String(campaignCode) : isNameRepeated(name) ? `${name} (${campaignCode})` : name,
			value: String(campaignCode),
		})),
		paginationToken: campaigns.length === CAMPAIGNS_PAGE_SIZE ? String(offset + CAMPAIGNS_PAGE_SIZE) : undefined,
	};
}
