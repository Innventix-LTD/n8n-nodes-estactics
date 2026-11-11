// INFO: Same messages as the Zapier app (integrations/zapier/lib/middleware.js), the replay hint points to the n8n Executions list.

export const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
export const NETWORK_ERROR_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'];
export const PERMISSIONS_HINT = 'Make sure the API token has the "Marketing Campaigns → View" and "Clients → Manage" permissions.';

interface EstacticsErrorData {
	message?: string;
	errorCode?: string;
	errorDetails?: unknown;
}

export interface FormattedError {
	message: string;
	description: string;
	errorCode: string;
}

/** Estactics errors are `{ success: false, data: { message, errorCode, errorDetails } }`. */
const parseErrorBody = (body: unknown): EstacticsErrorData => {
	let parsed = body;
	if (typeof body === 'string') {
		try {
			parsed = JSON.parse(body);
		} catch {
			return {};
		}
	}
	const data = (parsed as { data?: unknown } | null)?.data;

	return data && typeof data === 'object' ? (data as EstacticsErrorData) : {};
};

// INFO: Validation errors only say "Your request failed on validation.", the failing fields are listed in errorDetails.
export const getInvalidFields = (errorDetails: unknown): string[] => {
	if (!Array.isArray(errorDetails)) return [];

	const invalidFields = errorDetails.flatMap((detail) => [
		...Object.keys(detail?.valueErrors ?? {}),
		...Object.keys(detail?.schemaErrors ?? {}),
	]);

	return [...new Set(invalidFields)];
};

export const formatApiError = (statusCode: number, body: unknown): FormattedError => {
	const { message: errorMessage = `Estactics request failed with status ${statusCode}.`, errorCode = '', errorDetails } = parseErrorBody(body);
	const invalidFields = getInvalidFields(errorDetails);
	const message = invalidFields.length ? `${errorMessage} Invalid fields: ${invalidFields.join(', ')}.` : errorMessage;
	const code = typeof errorCode === 'string' ? errorCode : '';

	if (statusCode === 401) {
		return { message: `${message} Reconnect Estactics with a valid API token.`, description: 'The API token is invalid, expired or disabled. Create a new token in Estactics and update the credential.', errorCode: code };
	}
	if (statusCode === 402 || code.startsWith('PlanLimit')) {
		return {
			message: 'Your Estactics plan has reached its clients limit.',
			description: `Upgrade the plan in Estactics, then retry this execution from the Executions list to create the lead. (${errorMessage})`,
			errorCode: code,
		};
	}
	if (statusCode === 403) return { message: `${message} ${PERMISSIONS_HINT}`, description: PERMISSIONS_HINT, errorCode: code };
	if (RETRYABLE_STATUSES.includes(statusCode)) {
		return { message, description: 'Estactics is temporarily unavailable, the request was retried. Retry this execution later from the Executions list.', errorCode: code };
	}

	return { message, description: code ? `Estactics error code: ${code}` : '', errorCode: code };
};

/** n8n wraps request errors, the network error code (e.g ECONNRESET) can be on the error or on one of its causes. */
export const getNetworkErrorCode = (error: unknown): string | undefined => {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth++) {
		const { code, message } = current as { code?: unknown; message?: unknown };
		if (typeof code === 'string' && NETWORK_ERROR_CODES.includes(code)) return code;
		const codeInMessage = typeof message === 'string' ? NETWORK_ERROR_CODES.find((networkCode) => message.includes(networkCode)) : undefined;
		if (codeInMessage) return codeInMessage;
		current = (current as { cause?: unknown }).cause;
	}

	return undefined;
};
