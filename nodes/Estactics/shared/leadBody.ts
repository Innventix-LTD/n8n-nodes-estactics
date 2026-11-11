import type { IDataObject } from 'n8n-workflow';

// INFO: Ported from the Zapier app (integrations/zapier/creates/lead.js), the n8n node builds the exact same request body.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_JSON_ESCAPES = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't'];
const CONTROL_CHARACTERS_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };

export interface RegistrationFormAnswer {
	question?: string;
	answer?: unknown;
}

export interface LeadInput {
	campaignCode?: unknown;
	firstName?: unknown;
	lastName?: unknown;
	email?: unknown;
	phone?: unknown;
	additionalFields?: IDataObject;
	registrationForm?: RegistrationFormAnswer[];
}

export const trim = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

export const isBlank = (value: unknown): boolean =>
	value === undefined ||
	value === null ||
	value === '' ||
	(typeof value === 'object' && Object.keys(value as object).length === 0);

export const omitBlank = (object: IDataObject): IDataObject =>
	Object.fromEntries(Object.entries(object).filter(([, value]) => !isBlank(value))) as IDataObject;

const escapeControlCharacter = (character: string): string =>
	CONTROL_CHARACTERS_ESCAPES[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;

/**
 * Mapped values are inserted into the custom fields JSON as is, so a lead answer can break it, e.g "לא_בטוח\ה_עדיין" or a multi-line answer.
 * Inside JSON strings: a backslash that isn't a valid escape is escaped (\ה → \\ה) and raw control characters (new lines, tabs) are escaped.
 * Valid escapes (\n, \", \\, א) and everything outside strings are kept.
 */
export const repairJsonStrings = (json: string): string => {
	let repaired = '';
	let isInString = false;

	for (let index = 0; index < json.length; index++) {
		const character = json[index];

		if (!isInString) {
			if (character === '"') isInString = true;
			repaired += character;
		} else if (character === '\\') {
			const nextCharacter = json[index + 1];
			const isUnicodeEscape = nextCharacter === 'u' && /^[0-9a-fA-F]{4}$/.test(json.slice(index + 2, index + 6));
			// INFO: A value ending with a backslash ("value\") looks like an escaped quote, the quote closes the string when only a JSON separator follows.
			const isValueEndingBackslash = nextCharacter === '"' && /^\s*([,}\]:]|$)/.test(json.slice(index + 2));

			if (isValueEndingBackslash) {
				repaired += '\\\\';
			} else if (VALID_JSON_ESCAPES.includes(nextCharacter) || isUnicodeEscape) {
				repaired += character + nextCharacter;
				index++;
			} else {
				repaired += '\\\\';
			}
		} else if (character === '"') {
			isInString = false;
			repaired += character;
		} else if (character.charCodeAt(0) < 0x20) {
			repaired += escapeControlCharacter(character);
		} else {
			repaired += character;
		}
	}

	return repaired;
};

export type ParseCustomFieldsResult = { customFields: IDataObject } | { error: string };

const isPlainObject = (value: unknown): value is IDataObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JSON field resolves to a string, or to an object when it's a single expression like `{{ $json.fields }}`. */
export const parseCustomFields = (customFields: unknown): ParseCustomFieldsResult => {
	if (isBlank(trim(customFields))) return { customFields: {} };
	if (isPlainObject(customFields)) return { customFields };

	const notObjectError = { error: 'Custom Fields (JSON) must be a JSON object, e.g {"minBudget": 500000}.' };
	if (typeof customFields !== 'string') return notObjectError;

	let parsed: unknown;
	try {
		parsed = JSON.parse(customFields);
	} catch {
		try {
			parsed = JSON.parse(repairJsonStrings(customFields));
		} catch (error) {
			return { error: `Custom Fields (JSON) is not a valid JSON: ${(error as Error).message}` };
		}
	}

	return isPlainObject(parsed) ? { customFields: parsed } : notObjectError;
};

const buildRegistrationForm = (answers: RegistrationFormAnswer[] = []): IDataObject =>
	omitBlank(
		Object.fromEntries(
			answers
				.map(({ question, answer }) => [trim(question), trim(answer)] as const)
				.filter(([question]) => typeof question === 'string' && question !== ''),
		) as IDataObject,
	);

/** The mapped fields, same keys and cleaning as the Zapier app. Empty values are dropped. */
export const buildLead = ({ campaignCode, firstName, lastName, email, phone, additionalFields = {}, registrationForm }: LeadInput): IDataObject =>
	omitBlank({
		campaignCode: trim(campaignCode),
		firstName: trim(firstName),
		lastName: trim(lastName),
		email: trim(email),
		phone: trim(isBlank(phone) ? undefined : String(phone)),
		phoneDefaultCountry: trim(additionalFields.phoneDefaultCountry),
		language: trim(additionalFields.language),
		country: trim(additionalFields.country),
		city: trim(additionalFields.city),
		address: trim(additionalFields.address),
		interestNotes: trim(additionalFields.notes),
		utmSource: trim(additionalFields.utmSource),
		utmMedium: trim(additionalFields.utmMedium),
		utmCampaign: trim(additionalFields.utmCampaign),
		utmTerm: trim(additionalFields.utmTerm),
		utmContent: trim(additionalFields.utmContent),
		form: buildRegistrationForm(registrationForm),
	} as IDataObject);

/** Estactics requires a first name, a valid email and a phone for every client, checked before the request so the message is clear. */
export const getLeadDataError = ({ firstName, email, phone }: IDataObject): string | undefined => {
	if (isBlank(firstName)) return 'The lead has no first name, Estactics requires a first name for every client.';
	if (isBlank(email)) return 'The lead has no email, Estactics requires an email for every client.';
	if (!EMAIL_PATTERN.test(String(email))) return `The lead email "${email}" is not a valid email.`;
	if (isBlank(phone)) return 'The lead has no phone, Estactics requires a phone for every client.';

	return undefined;
};
