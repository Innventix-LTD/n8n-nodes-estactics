import type { IDataObject, IExecuteFunctions, IN8nHttpFullResponse, ILoadOptionsFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';
import { formatApiError, getNetworkErrorCode, RETRYABLE_STATUSES } from './errors';

export const CREDENTIAL_NAME = 'estacticsApi';
export const DEFAULT_BASE_URL = 'https://backend.estactics.com';

// INFO: Zapier retries a failed step for us, in n8n the node retries temporary failures itself so a lead isn't lost on a short outage.
// Mutable so tests can run without waiting.
export const retrySettings = { delaysSeconds: [5, 15, 30], maxRetryAfterSeconds: 60 };

const REQUEST_TIMEOUT_MS = 60_000;

interface EstacticsRequestOptions {
	itemIndex?: number;
	/** Off for dropdowns, the user is waiting for the list. */
	retry?: boolean;
}

const getRetryDelaySeconds = (headers: IDataObject | undefined, attempt: number): number => {
	const retryAfter = Number(headers?.['retry-after']);
	if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, retrySettings.maxRetryAfterSeconds);

	return retrySettings.delaysSeconds[attempt];
};

export const getApiUrl = (baseUrl: unknown, endpoint: string): string =>
	`${String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')}/api/${endpoint}`;

/**
 * POSTs to an Estactics API endpoint with the credential token and returns the response `data`.
 * - Network failures, 408, 429 and 5xx are retried with a delay (the Retry-After header when sent).
 * - Other errors throw a NodeApiError with the Estactics message and a hint (reconnect, permissions, plan limit).
 */
export async function estacticsRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	endpoint: string,
	body: IDataObject,
	{ itemIndex, retry = true }: EstacticsRequestOptions = {},
): Promise<unknown> {
	const { baseUrl } = await this.getCredentials(CREDENTIAL_NAME);
	const maxRetries = retry ? retrySettings.delaysSeconds.length : 0;

	for (let attempt = 0; ; attempt++) {
		let response: IN8nHttpFullResponse;
		try {
			response = (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, {
				method: 'POST',
				url: getApiUrl(baseUrl, endpoint),
				body,
				json: true,
				headers: { Accept: 'application/json' },
				timeout: REQUEST_TIMEOUT_MS,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			})) as IN8nHttpFullResponse;
		} catch (error) {
			const networkErrorCode = getNetworkErrorCode(error);
			if (networkErrorCode && attempt < maxRetries) {
				await sleep(retrySettings.delaysSeconds[attempt] * 1000);
				continue;
			}
			// INFO: The network code goes in the description, NodeApiError replaces a message containing one (e.g ETIMEDOUT) by a generic message.
			const errorResponse = networkErrorCode ? { message: (error as Error).message, networkErrorCode } : (error as JsonObject);
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: networkErrorCode ? 'Estactics is unreachable.' : (error as Error).message,
				description: networkErrorCode
					? `Network error ${networkErrorCode}, the request was retried. Retry this execution later from the Executions list.`
					: undefined,
				itemIndex,
			});
		}

		const { statusCode, headers, body: responseBody } = response;
		if (statusCode < 400) return (responseBody as IDataObject | undefined)?.data;

		if (RETRYABLE_STATUSES.includes(statusCode) && attempt < maxRetries) {
			await sleep(getRetryDelaySeconds(headers, attempt) * 1000);
			continue;
		}

		const { message, description } = formatApiError(statusCode, responseBody);
		const errorResponse = responseBody && typeof responseBody === 'object' ? (responseBody as JsonObject) : { body: String(responseBody ?? '') };
		throw new NodeApiError(this.getNode(), errorResponse, { message, description, httpCode: String(statusCode), itemIndex });
	}
}
