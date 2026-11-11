const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { Estactics, createContext, ok, fail } = require('./helpers');
const { EstacticsApi } = require('../dist/credentials/EstacticsApi.credentials.js');
const packageJson = require('../package.json');

const searchCampaigns = (filter, paginationToken, responses) => {
	const { context, requests } = createContext({ responses });

	return { promise: new Estactics().methods.listSearch.searchCampaigns.call(context, filter, paginationToken), requests };
};

describe('campaign dropdown', () => {
	it('lists active campaigns with a code, sorted by name', async () => {
		const { promise, requests } = searchCampaigns(undefined, undefined, [
			ok([
				{ id: 1, name: 'Tel Aviv Q4', campaignCode: 'CAMP1' },
				{ id: 2, name: 'No code', campaignCode: null },
			]),
		]);

		assert.deepEqual(await promise, { results: [{ name: 'Tel Aviv Q4', value: 'CAMP1' }], paginationToken: undefined });
		assert.equal(requests[0].url, 'https://backend.estactics.com/api/marketingCampaigns/search');
		assert.deepEqual(requests[0].body, {
			fields: ['id', 'name', 'campaignCode'],
			filters: { status: ['ACTIVE'] },
			orderBy: { name: 'ASC' },
			limit: 100,
			offset: 0,
		});
	});

	it('adds the code to campaigns sharing a name', async () => {
		const { promise } = searchCampaigns(undefined, undefined, [
			ok([
				{ id: 1, name: 'Organic leads', campaignCode: 'CAMP1' },
				{ id: 2, name: 'Organic leads', campaignCode: 'CAMP2' },
				{ id: 3, name: 'Spring', campaignCode: 'CAMP3' },
			]),
		]);

		assert.deepEqual((await promise).results, [
			{ name: 'Organic leads (CAMP1)', value: 'CAMP1' },
			{ name: 'Organic leads (CAMP2)', value: 'CAMP2' },
			{ name: 'Spring', value: 'CAMP3' },
		]);
	});

	it('searches by name, matching the typed text literally', async () => {
		const { promise, requests } = searchCampaigns(' Q4 (Paphos) ', undefined, [ok([])]);
		await promise;

		assert.deepEqual(requests[0].body.filters, { status: ['ACTIVE'], name: ['Q4 \\(Paphos\\)'] });
	});

	it('paginates by 100 campaigns', async () => {
		const page = Array.from({ length: 100 }, (_, index) => ({ id: index, name: `Campaign ${index}`, campaignCode: `C${index}` }));
		const { promise, requests } = searchCampaigns('', '100', [ok(page)]);

		assert.equal((await promise).paginationToken, '200');
		assert.equal(requests[0].body.offset, 100);
	});

	it('shows the permissions hint without retrying when the token cannot list campaigns', async () => {
		const { promise, requests } = searchCampaigns('', undefined, [
			fail(403, { message: 'Endpoint is not valid for the user provided token.', errorCode: 'Forbidden.AccessNotGrantedForUserToken' }),
		]);

		await assert.rejects(promise, { message: /Marketing Campaigns → View/ });
		assert.equal(requests.length, 1);
	});

	it('does not retry a temporary failure while the user waits for the list', async () => {
		const { promise, requests } = searchCampaigns('', undefined, [fail(503, { message: 'Service unavailable' })]);

		await assert.rejects(promise, { httpCode: '503' });
		assert.equal(requests.length, 1);
	});
});

describe('credential', () => {
	const credential = new EstacticsApi();

	it('sends the token as a bearer token', () => {
		assert.deepEqual(credential.authenticate, { type: 'generic', properties: { headers: { Authorization: '=Bearer {{$credentials.apiToken}}' } } });
	});

	it('is tested by listing a campaign, so a token missing the campaigns permission fails when connecting', () => {
		assert.equal(credential.test.request.url, '/marketingCampaigns/search');
		assert.equal(credential.test.request.method, 'POST');
		assert.deepEqual(credential.test.request.body, { fields: ['id'], limit: 1 });
	});

	it('marks the token as a password and defaults to production', () => {
		const properties = Object.fromEntries(credential.properties.map((property) => [property.name, property]));

		assert.equal(properties.apiToken.typeOptions.password, true);
		assert.equal(properties.baseUrl.default, 'https://backend.estactics.com');
	});
});

// INFO: The Zapier choices exist only in the Estactics monorepo, not in the public mirror of this folder.
const zapierChoicesPath = path.join(__dirname, '../../zapier/lib/choices.json');
const skipWithoutZapierChoices = !existsSync(zapierChoicesPath) && 'the Zapier app is not next to this package';

describe('package', () => {
	it('registers the built node and credential', () => {
		for (const file of [...packageJson.n8n.nodes, ...packageJson.n8n.credentials]) {
			assert.ok(require(path.join(__dirname, '..', file)), file);
		}
	});

	it('has the country and language options in sync with the Zapier choices (run `npm run sync-choices`)', { skip: skipWithoutZapierChoices }, async () => {
		const { renderChoices } = await import('../scripts/sync-choices.mjs');
		const choices = JSON.parse(readFileSync(zapierChoicesPath, 'utf8'));
		const current = readFileSync(path.join(__dirname, '../nodes/Estactics/shared/choices.ts'), 'utf8');

		assert.equal(current, renderChoices(choices));
	});

	it('offers every Zapier country and language value', { skip: skipWithoutZapierChoices }, () => {
		const { countryCodeOptions, countryOptions, languageOptions } = require('../dist/nodes/Estactics/shared/choices.js');
		const choices = JSON.parse(readFileSync(zapierChoicesPath, 'utf8'));

		assert.deepEqual(countryCodeOptions.map(({ value }) => value), Object.keys(choices.countries));
		assert.deepEqual(countryOptions.map(({ value }) => value), Object.keys(choices.countryLabels));
		assert.deepEqual(languageOptions.map(({ value }) => value), Object.keys(choices.languages));
	});
});
