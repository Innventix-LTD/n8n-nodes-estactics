import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { createLead, leadCreateProperties } from './actions/lead/create';
import { searchCampaigns } from './methods/searchCampaigns';

/**
 * Programmatic style (not declarative): creating a lead needs logic a routing description can't express, the custom fields JSON repair,
 * lead data checks before the request, retries of temporary failures and Estactics specific error messages.
 */
export class Estactics implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Estactics',
		name: 'estactics',
		icon: { light: 'file:../../icons/estactics.svg', dark: 'file:../../icons/estactics.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create leads in Estactics, the real estate CRM',
		defaults: { name: 'Estactics' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'estacticsApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Lead', value: 'lead' }],
				default: 'lead',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['lead'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a lead under an active campaign',
						action: 'Create a lead',
					},
				],
				default: 'create',
			},
			...leadCreateProperties,
		],
	};

	methods = {
		listSearch: { searchCampaigns },
	};

	// INFO: Items run one by one, every lead is its own request and a failing lead fails (or with "Continue" skips) only its item.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const lead = await createLead.call(this, itemIndex);
				returnData.push({ json: lead, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
					continue;
				}
				// INFO: Errors from createLead are already n8n errors, re-wrapping returns the same error.
				if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
