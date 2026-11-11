// Mocked n8n execution / load options context for the built node (dist), requests are answered from a queue of responses.
const { Estactics } = require('../dist/nodes/Estactics/Estactics.node.js');
const { retrySettings } = require('../dist/nodes/Estactics/shared/request.js');

// INFO: No waiting between retries in tests.
retrySettings.delaysSeconds = [0, 0, 0];
retrySettings.maxRetryAfterSeconds = 0;

const node = { id: '1', name: 'Estactics', type: '@estactics/n8n-nodes-estactics.estactics', typeVersion: 1, position: [0, 0], parameters: {} };
const credentials = { apiToken: 'atsec_test', baseUrl: 'https://backend.estactics.com' };

const ok = (data) => ({ statusCode: 200, headers: {}, body: { success: true, data } });
const fail = (statusCode, data, headers = {}) => ({ statusCode, headers, body: { success: false, data } });
const networkError = (code) => Object.assign(new Error(`connect ${code}`), { code });

const getPath = (object, path) => path.split('.').reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), object);

const createContext = ({ parameters = [{}], responses = [], continueOnFail = false, baseUrl = credentials.baseUrl } = {}) => {
	const requests = [];
	const context = {
		getInputData: () => parameters.map(() => ({ json: {} })),
		getNode: () => node,
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ ...credentials, baseUrl }),
		getNodeParameter: (name, itemIndex, fallback, options) => {
			const value = getPath(parameters[itemIndex], name);
			if (value === undefined) return fallback;
			if (options?.extractValue && value && typeof value === 'object') return value.value;
			return value;
		},
		helpers: {
			httpRequestWithAuthentication: async (credentialName, options) => {
				requests.push({ credentialName, ...options });
				const response = responses.shift();
				if (!response) throw new Error(`Unexpected request to ${options.url}`);
				if (response instanceof Error) throw response;
				return response;
			},
		},
	};

	return { context, requests };
};

const leadParameters = {
	campaign: { mode: 'list', value: 'CAMP1' },
	firstName: ' Dana ',
	lastName: 'Cohen Levi',
	email: 'dana@example.com',
	phone: '+972 50-123-4567',
};

const runNode = (options) => {
	const { context, requests } = createContext(options);
	const promise = new Estactics().execute.call(context);

	return { promise, requests };
};

module.exports = { Estactics, createContext, runNode, ok, fail, networkError, leadParameters };
