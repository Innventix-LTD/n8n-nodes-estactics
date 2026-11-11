const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runNode, ok, fail, networkError, leadParameters } = require('./helpers');

const createLead = async (parameters, responses = [ok({ id: 42 })], options = {}) => {
	const { promise, requests } = runNode({ parameters: [parameters], responses, ...options });
	const [[item]] = await promise;

	return { item, requests, sentBody: requests[0]?.body };
};

describe('create lead', () => {
	it('trims the name, keeps the raw phone and never fails on an existing client', async () => {
		const { item, requests, sentBody } = await createLead({
			...leadParameters,
			additionalFields: { phoneDefaultCountry: 'IL', city: ' ' },
			registrationForm: { answers: [{ question: 'Budget', answer: '1M' }, { question: 'Rooms', answer: '' }] },
		});

		assert.equal(requests[0].credentialName, 'estacticsApi');
		assert.equal(requests[0].method, 'POST');
		assert.equal(requests[0].url, 'https://backend.estactics.com/api/clients/create');
		assert.deepEqual(sentBody, {
			campaignCode: 'CAMP1',
			firstName: 'Dana',
			lastName: 'Cohen Levi',
			email: 'dana@example.com',
			phone: '+972 50-123-4567',
			phoneDefaultCountry: 'IL',
			form: { Budget: '1M' },
			throwErrorOnClientExists: false,
		});
		assert.deepEqual(item.json, { ...sentBody, id: 42, requestBody: JSON.stringify(sentBody, null, 2) });
		assert.deepEqual(item.pairedItem, { item: 0 });
	});

	it('drops empty values', async () => {
		const { sentBody } = await createLead({
			...leadParameters,
			lastName: '',
			additionalFields: { city: '', utmSource: '  ', customFields: '{}' },
			registrationForm: { answers: [{ question: ' ', answer: 'x' }] },
		});

		assert.deepEqual(sentBody, {
			campaignCode: 'CAMP1',
			firstName: 'Dana',
			email: 'dana@example.com',
			phone: '+972 50-123-4567',
			throwErrorOnClientExists: false,
		});
	});

	it('sends every additional field with the Zapier keys', async () => {
		const { sentBody } = await createLead({
			...leadParameters,
			additionalFields: {
				language: 'he',
				country: 'Israel',
				city: 'Tel Aviv',
				address: 'Rothschild 1',
				notes: 'Looking for a penthouse',
				utmSource: 'facebook',
				utmMedium: 'paid_social',
				utmCampaign: 'Spring',
				utmTerm: 'Audience A',
				utmContent: 'Video ad',
			},
		});

		assert.deepEqual(sentBody, {
			campaignCode: 'CAMP1',
			firstName: 'Dana',
			lastName: 'Cohen Levi',
			email: 'dana@example.com',
			phone: '+972 50-123-4567',
			language: 'he',
			country: 'Israel',
			city: 'Tel Aviv',
			address: 'Rothschild 1',
			interestNotes: 'Looking for a penthouse',
			utmSource: 'facebook',
			utmMedium: 'paid_social',
			utmCampaign: 'Spring',
			utmTerm: 'Audience A',
			utmContent: 'Video ad',
			throwErrorOnClientExists: false,
		});
	});

	it('sends a numeric phone (mapped from a number) as a string and supports a campaign by code', async () => {
		const { sentBody } = await createLead({ ...leadParameters, campaign: { mode: 'code', value: ' CAMP2 ' }, phone: 972501234567 });

		assert.equal(sentBody.phone, '972501234567');
		assert.equal(sentBody.campaignCode, 'CAMP2');
	});

	it('merges the custom fields JSON over the mapped fields', async () => {
		const { item, sentBody } = await createLead({
			...leadParameters,
			additionalFields: { customFields: '{"minBudget": 500000, "firstName": "Dani"}' },
		});

		assert.equal(sentBody.minBudget, 500000);
		assert.equal(sentBody.firstName, 'Dani');
		assert.equal(sentBody.lastName, 'Cohen Levi');
		assert.equal(item.json.minBudget, 500000);
	});

	it('accepts custom fields resolved to an object by an expression', async () => {
		const { sentBody } = await createLead({ ...leadParameters, additionalFields: { customFields: { preferredCity: 'Paphos' } } });

		assert.equal(sentBody.preferredCity, 'Paphos');
	});

	for (const [name, customFields, interestNotes] of [
		['an invalid escape', '{"interestNotes": "לא_בטוח\\ה_עדיין"}', 'לא_בטוח\\ה_עדיין'],
		['a value ending with a backslash', '{"interestNotes": "path\\", "minBudget": 1}', 'path\\'],
		['a multi-line value', '{"interestNotes": "line 1\nline 2\tend"}', 'line 1\nline 2\tend'],
		['valid escapes', '{"interestNotes": "a\\\\b \\"q\\" \\u05D0 \\n"}', 'a\\b "q" א \n'],
	]) {
		it(`repairs custom fields JSON with ${name}`, async () => {
			const { sentBody } = await createLead({ ...leadParameters, additionalFields: { customFields } });

			assert.equal(sentBody.interestNotes, interestNotes);
		});
	}

	it('errors on invalid custom fields JSON without calling Estactics', async () => {
		const { promise, requests } = runNode({ parameters: [{ ...leadParameters, additionalFields: { customFields: '{minBudget' } }] });

		await assert.rejects(promise, { name: 'NodeOperationError', message: /not a valid JSON/ });
		assert.equal(requests.length, 0);
	});

	it('errors on custom fields that are not a JSON object', async () => {
		const { promise } = runNode({ parameters: [{ ...leadParameters, additionalFields: { customFields: '[1, 2]' } }] });

		await assert.rejects(promise, { message: /must be a JSON object/ });
	});

	for (const [override, message] of [
		[{ firstName: '' }, /no first name/],
		[{ email: '' }, /no email/],
		[{ email: 'dana@' }, /not a valid email/],
		[{ phone: '' }, /no phone/],
	]) {
		it(`stops a lead with missing data ${JSON.stringify(override)} before calling Estactics`, async () => {
			const { promise, requests } = runNode({ parameters: [{ ...leadParameters, ...override }] });

			await assert.rejects(promise, { name: 'NodeOperationError', message });
			assert.equal(requests.length, 0);
		});
	}
});

describe('errors', () => {
	it('shows the invalid phone message from Estactics', async () => {
		const { promise } = runNode({
			parameters: [{ ...leadParameters, phone: '12345' }],
			responses: [fail(400, { message: "Phone '12345' is not a valid phone number.", errorCode: 'BadRequest.InvalidPhoneNumber' })],
		});

		await assert.rejects(promise, { name: 'NodeApiError', message: "Phone '12345' is not a valid phone number.", httpCode: '400' });
	});

	it('lists the invalid fields of a validation error', async () => {
		const { promise } = runNode({
			parameters: [leadParameters],
			responses: [
				fail(400, {
					message: 'Your request failed on validation.',
					errorCode: 'ValidationError',
					errorDetails: [
						{ message: 'every key in the object needs to match validation:', valueErrors: { phoneDefaultCountry: [{ message: 'string should match' }] } },
						{ message: 'object needs to match the provided schema', schemaErrors: { phoneDialCode: [{}], phone: [{}] } },
					],
				}),
			],
		});

		await assert.rejects(promise, { message: 'Your request failed on validation. Invalid fields: phoneDefaultCountry, phoneDialCode, phone.' });
	});

	for (const [status, errorCode, message, expected] of [
		[401, 'Unauthorized.TokenNotValid', 'Provided token is invalid', /Reconnect Estactics with a valid API token/],
		[404, 'NotFound', 'Campaign code CAMP1 was not found.', /^Campaign code CAMP1 was not found\.$/],
		[402, 'PlanLimit.ClientsLimitReached', 'Plan clients limit exceeded.', /plan has reached its clients limit/],
		[403, 'Forbidden.AccessNotGrantedForUserToken', 'Endpoint is not valid for the user provided token.', /Clients → Manage/],
	]) {
		it(`explains a ${status} error`, async () => {
			const { promise, requests } = runNode({ parameters: [leadParameters], responses: [fail(status, { message, errorCode })] });

			await assert.rejects(promise, { name: 'NodeApiError', message: expected, httpCode: String(status) });
			assert.equal(requests.length, 1);
		});
	}

	it('tells to retry from the Executions list after upgrading the plan', async () => {
		const { promise } = runNode({ parameters: [leadParameters], responses: [fail(402, { message: 'Plan clients limit exceeded.', errorCode: 'PlanLimit.ClientsLimitReached' })] });

		await assert.rejects(promise, { description: /Upgrade the plan in Estactics, then retry this execution from the Executions list/ });
	});

	for (const status of [408, 429, 500, 502, 503, 504]) {
		it(`retries a temporary ${status} failure and creates the lead`, async () => {
			const { promise, requests } = runNode({
				parameters: [leadParameters],
				responses: [fail(status, { message: 'Temporary failure' }), fail(status, { message: 'Temporary failure' }), ok({ id: 9 })],
			});
			const [[item]] = await promise;

			assert.equal(requests.length, 3);
			assert.equal(item.json.id, 9);
		});
	}

	it('fails after the retries of a temporary failure are used', async () => {
		const temporaryFailure = () => fail(503, { message: 'Service unavailable' });
		const { promise, requests } = runNode({ parameters: [leadParameters], responses: [1, 2, 3, 4].map(temporaryFailure) });

		await assert.rejects(promise, { name: 'NodeApiError', message: 'Service unavailable', httpCode: '503' });
		assert.equal(requests.length, 4);
	});

	it('retries a network failure', async () => {
		const { promise, requests } = runNode({ parameters: [leadParameters], responses: [networkError('ECONNRESET'), ok({ id: 5 })] });
		const [[item]] = await promise;

		assert.equal(requests.length, 2);
		assert.equal(item.json.id, 5);
	});

	it('finds a network error code on a wrapped error', async () => {
		const wrapped = Object.assign(new Error('Request failed'), { cause: networkError('ETIMEDOUT') });
		const { promise } = runNode({ parameters: [leadParameters], responses: [wrapped, wrapped, wrapped, wrapped] });

		await assert.rejects(promise, { name: 'NodeApiError', message: 'Estactics is unreachable.', description: /Network error ETIMEDOUT/ });
	});

	it('does not retry an unknown request error', async () => {
		const { promise, requests } = runNode({ parameters: [leadParameters], responses: [new Error('Something else')] });

		await assert.rejects(promise, { name: 'NodeApiError', message: 'Something else' });
		assert.equal(requests.length, 1);
	});
});

describe('items', () => {
	it('creates one lead per item, linked to its input item', async () => {
		const { promise } = runNode({
			parameters: [leadParameters, { ...leadParameters, firstName: 'Noa', email: 'noa@example.com' }],
			responses: [ok({ id: 1 }), ok({ id: 2 })],
		});
		const [items] = await promise;

		assert.deepEqual(
			items.map(({ json, pairedItem }) => [json.id, json.firstName, pairedItem.item]),
			[
				[1, 'Dana', 0],
				[2, 'Noa', 1],
			],
		);
	});

	it('continues on fail: a failing lead returns its error and the next lead is created', async () => {
		const { promise } = runNode({
			parameters: [{ ...leadParameters, email: 'dana@' }, leadParameters],
			responses: [ok({ id: 2 })],
			continueOnFail: true,
		});
		const [items] = await promise;

		assert.match(items[0].json.error, /not a valid email/);
		assert.deepEqual(items[0].pairedItem, { item: 0 });
		assert.equal(items[1].json.id, 2);
	});

	it('uses the credential base URL without a trailing slash', async () => {
		const { promise, requests } = runNode({ parameters: [leadParameters], responses: [ok({ id: 1 })], baseUrl: 'http://localhost:4000/ ' });
		await promise;

		assert.equal(requests[0].url, 'http://localhost:4000/api/clients/create');
	});
});
