import { browser } from '$app/environment';
import { urlDecode, urlEncode } from './base64';

let compress: any;
let decompress: any;

if (browser) {
	const pkg = await import('brotli-compress');
	compress = pkg.compress;
	decompress = pkg.decompress;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const URL_DICTIONARY = [
	'https://',
	'http://',
	'www.',
	'.com',
	'.org',
	'.net',
	'.io',
	'.co',
	'.dev',
	'.app',
	'.ai',
	'.gg',
	'.me',
	'.tv',
	'.ly',
	'.to',
	'.us',
	'.uk',
	'.de',
	'.fr',
	'.jp',
	'.cn',
	'/',
	'?',
	'&',
	'=',
	'utm_source=',
	'utm_medium=',
	'utm_campaign=',
	'utm_content=',
	'utm_term=',
	'ref=',
	'source=',
	'fbclid=',
	'gclid=',
	'id=',
	'lang=',
	'page=',
	'view=',
	'q=',
	'v=',
	'://',
	'#',
	'#/',
	'.edu',
	'.gov',
	'.biz',
	'.info',
	'.xyz',
	'.site',
	'.tech',
	'.cloud',
	'.store',
	'.shop',
	'.online',
	'.co.uk',
	'.com.au',
	'.co.jp',
	'github.com',
	'google.com',
	'youtube.com',
	'facebook.com',
	'instagram.com',
	'twitter.com',
	'amazon.com',
	'wikipedia.org',
	'reddit.com',
	'docs.',
	'api.',
	'cdn.',
	'static.',
	'assets/',
	'images/',
	'img/',
	'css/',
	'js/',
	'fonts/',
	'/api/',
	'/v1/',
	'/v2/',
	'/v3/',
	'/v4/',
	'utm_id=',
	'utm_name=',
	'ref_src=',
	'ref_url=',
	'referrer=',
	'redirect=',
	'redirect_uri=',
	'return=',
	'callback=',
	'state=',
	'code=',
	'scope=',
	'client_id=',
	'client_secret=',
	'session=',
	'token=',
	'per_page=',
	'limit=',
	'offset=',
	'sort=',
	'order=',
	'filter=',
	'search=',
	'query=',
	'tag=',
	'category=',
	'locale=',
	'format=',
	'download=',
	'file=',
	'path=',
	'next=',
	'continue=',
	'index.html',
	'robots.txt',
	'sitemap.xml',
	'favicon.ico'
].join('\n');

const URL_DICTIONARY_BYTES = textEncoder.encode(URL_DICTIONARY);
const URL_DICTIONARY_I8 = new Int8Array(URL_DICTIONARY_BYTES);

const RAW_PREFIX = '~';
const TOKEN_PREFIX = '!';
const TOKEN_RAW_PREFIX = '.';
export const PASSWORD_PREFIX = '@';

const TOKEN_BASE = 0x80;
const ESCAPE_BYTE = 0x7f;

const ENCRYPTION_VERSION = 1;
const ENCRYPTION_SALT_BYTES = 16;
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_ITERATIONS = 100_000;

// Append-only; token indices are part of the encoding format.
const TOKEN_STRINGS = [
	'https://www.',
	'http://www.',
	'https://',
	'http://',
	'www.',
	'://',
	'/?',
	'.com',
	'.org',
	'.net',
	'.io',
	'.co',
	'.dev',
	'.app',
	'.ai',
	'.gg',
	'.me',
	'.tv',
	'.ly',
	'.to',
	'.us',
	'.uk',
	'.de',
	'.fr',
	'.jp',
	'.cn',
	'.edu',
	'.gov',
	'github.com',
	'gitlab.com',
	'youtu.be',
	'youtube.com',
	'google',
	'youtube',
	'facebook',
	'instagram',
	'twitter',
	'amazon',
	'wikipedia',
	'reddit',
	'twitter.com',
	'x.com',
	'reddit.com',
	'docs.',
	'api.',
	'cdn.',
	'static.',
	'blog.',
	'm.',
	'amp.',
	'utm_source=',
	'utm_medium=',
	'utm_campaign=',
	'utm_content=',
	'utm_term=',
	'utm_id=',
	'utm_name=',
	'ref=',
	'ref_src=',
	'ref_url=',
	'source=',
	'fbclid=',
	'gclid=',
	'id=',
	'lang=',
	'page=',
	'&page=',
	'view=',
	'q=',
	'v=',
	's=',
	't=',
	'feature=',
	'si=',
	'redirect=',
	'redirect_uri=',
	'state=',
	'&state=',
	'code=',
	'scope=',
	'client_id=',
	'&client_id=',
	'token=',
	'&token=',
	'per_page=',
	'limit=',
	'offset=',
	'sort=',
	'order=',
	'filter=',
	'search=',
	'query=',
	'tag=',
	'category=',
	'next=',
	'raw.githubusercontent.com',
	'npmjs.com',
	'stackoverflow.com',
	'stackexchange.com',
	'docs.google.com',
	'drive.google.com',
	'vercel.app',
	'supabase.co',
	's3.amazonaws.com',
	'assets/',
	'images/',
	'img/',
	'css/',
	'js/',
	'fonts/',
	'/api/',
	'/v1/',
	'/v2/',
	'/v3/',
	'/v4/',
	'/blob/',
	'/tree/',
	'/raw/',
	'/issues/',
	'/pull/',
	'/releases/',
	'/tag/',
	'/commit/',
	'/wiki/',
	'index.html',
	'robots.txt',
	'sitemap.xml',
	'favicon.ico'
];

const TOKEN_BYTES = TOKEN_STRINGS.map((token) => textEncoder.encode(token));
const TOKEN_ENTRIES = TOKEN_STRINGS.map((value, index) => ({ value, index })).sort(
	(a, b) => b.value.length - a.value.length
);

type WebCryptoBytes = Uint8Array<ArrayBuffer>;

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const chunk of chunks) total += chunk.length;

	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}

	return out;
}

function toWebCryptoBytes(bytes: Uint8Array): WebCryptoBytes {
	if (bytes.buffer instanceof ArrayBuffer) {
		return bytes as WebCryptoBytes;
	}

	return new Uint8Array(bytes) as WebCryptoBytes;
}

function requireCrypto(): Crypto {
	const cryptoRef = globalThis.crypto;
	if (!browser || !cryptoRef?.subtle) {
		throw new Error('Web Crypto is unavailable in this environment.');
	}
	return cryptoRef;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const cryptoRef = requireCrypto();
	const keyMaterial = await cryptoRef.subtle.importKey(
		'raw',
		toWebCryptoBytes(textEncoder.encode(password)),
		'PBKDF2',
		false,
		['deriveKey']
	);

	return cryptoRef.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: toWebCryptoBytes(salt),
			iterations: ENCRYPTION_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

async function encryptWithPassword(payload: Uint8Array, password: string): Promise<Uint8Array> {
	const cryptoRef = requireCrypto();
	const salt = toWebCryptoBytes(cryptoRef.getRandomValues(new Uint8Array(ENCRYPTION_SALT_BYTES)));
	const iv = toWebCryptoBytes(cryptoRef.getRandomValues(new Uint8Array(ENCRYPTION_IV_BYTES)));
	const key = await deriveKey(password, salt);
	const encrypted = await cryptoRef.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		toWebCryptoBytes(payload)
	);

	const header = new Uint8Array(1 + ENCRYPTION_SALT_BYTES + ENCRYPTION_IV_BYTES);
	header[0] = ENCRYPTION_VERSION;
	header.set(salt, 1);
	header.set(iv, 1 + ENCRYPTION_SALT_BYTES);

	return concatBytes(header, new Uint8Array(encrypted));
}

async function decryptWithPassword(payload: Uint8Array, password: string): Promise<Uint8Array> {
	const cryptoRef = requireCrypto();
	const headerLength = 1 + ENCRYPTION_SALT_BYTES + ENCRYPTION_IV_BYTES;
	if (payload.length < headerLength) {
		throw new Error('Encrypted payload is too short.');
	}

	const version = payload[0];
	if (version !== ENCRYPTION_VERSION) {
		throw new Error('Unsupported encryption version.');
	}

	const saltStart = 1;
	const ivStart = saltStart + ENCRYPTION_SALT_BYTES;
	const cipherStart = ivStart + ENCRYPTION_IV_BYTES;
	const salt = toWebCryptoBytes(payload.slice(saltStart, ivStart));
	const iv = toWebCryptoBytes(payload.slice(ivStart, cipherStart));
	const cipher = toWebCryptoBytes(payload.slice(cipherStart));

	const key = await deriveKey(password, salt);
	const decrypted = await cryptoRef.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);

	return new Uint8Array(decrypted);
}

async function compressWithDictionary(inputBytes: Uint8Array): Promise<Uint8Array> {
	return compress(inputBytes, {
		quality: 11,
		customDictionary: URL_DICTIONARY_I8
	});
}

function tokenizeUrl(input: string): Uint8Array {
	const out: number[] = [];
	let i = 0;

	while (i < input.length) {
		let matchedIndex = -1;
		let matchedLength = 0;

		for (const token of TOKEN_ENTRIES) {
			if (input.startsWith(token.value, i)) {
				matchedIndex = token.index;
				matchedLength = token.value.length;
				break;
			}
		}

		if (matchedIndex >= 0) {
			out.push(TOKEN_BASE + matchedIndex);
			i += matchedLength;
			continue;
		}

		const codePoint = input.codePointAt(i);
		if (codePoint === undefined) break;
		const char = String.fromCodePoint(codePoint);
		const bytes = textEncoder.encode(char);

		for (const byte of bytes) {
			if (byte === ESCAPE_BYTE || byte >= TOKEN_BASE) {
				out.push(ESCAPE_BYTE, byte);
			} else {
				out.push(byte);
			}
		}

		i += char.length;
	}

	return new Uint8Array(out);
}

function detokenizeUrl(data: Uint8Array): string {
	const out: number[] = [];

	for (let i = 0; i < data.length; i += 1) {
		const byte = data[i];

		if (byte === ESCAPE_BYTE) {
			const next = data[i + 1];
			if (next === undefined) {
				out.push(ESCAPE_BYTE);
				break;
			}
			out.push(next);
			i += 1;
			continue;
		}

		if (byte >= TOKEN_BASE) {
			const tokenIndex = byte - TOKEN_BASE;
			const tokenBytes = TOKEN_BYTES[tokenIndex];
			if (tokenBytes) {
				for (const tokenByte of tokenBytes) out.push(tokenByte);
				continue;
			}
		}

		out.push(byte);
	}

	return textDecoder.decode(new Uint8Array(out));
}

/**
 * Compresses a string with Brotli + encodes using Base64.
 */
async function encodePlain(input: string): Promise<string> {
	const inputBytes = textEncoder.encode(input);
	const tokenizedBytes = tokenizeUrl(input);

	const [withDict, withoutDict, tokenizedCompressed] = await Promise.all([
		compressWithDictionary(inputBytes),
		compress(inputBytes, { quality: 11 }),
		compress(tokenizedBytes, { quality: 11 })
	]);

	const bestCompressed = withDict.length <= withoutDict.length ? withDict : withoutDict;
	const compressedEncoded = urlEncode(bestCompressed);

	const tokenizedCompressedCandidate = `${TOKEN_PREFIX}${urlEncode(tokenizedCompressed)}`;
	const tokenizedRawCandidate = `${TOKEN_RAW_PREFIX}${urlEncode(tokenizedBytes)}`;

	const rawEncoded = urlEncode(inputBytes);
	const rawCandidate = `${RAW_PREFIX}${rawEncoded}`;

	let best = compressedEncoded;

	// Debug
	// console.log(
	// 	compressedEncoded.length,
	// 	tokenizedCompressedCandidate.length,
	// 	tokenizedRawCandidate.length,
	// 	rawCandidate.length
	// );

	if (tokenizedCompressedCandidate.length < best.length) best = tokenizedCompressedCandidate;
	if (tokenizedRawCandidate.length < best.length) best = tokenizedRawCandidate;
	if (rawCandidate.length < best.length) best = rawCandidate;

	return best;
}

/**
 * Decodes from Base64 + decompresses with Brotli back to the original string.
 */
async function decodePlain(data: string): Promise<string> {
	if (data.startsWith(RAW_PREFIX)) {
		const rawBytes = urlDecode(data.slice(RAW_PREFIX.length));
		return textDecoder.decode(rawBytes);
	}

	if (data.startsWith(TOKEN_PREFIX)) {
		const compressedBytes = urlDecode(data.slice(TOKEN_PREFIX.length));
		const decompressed = await decompress(compressedBytes);
		return detokenizeUrl(decompressed);
	}

	if (data.startsWith(TOKEN_RAW_PREFIX)) {
		const tokenizedBytes = urlDecode(data.slice(TOKEN_RAW_PREFIX.length));
		return detokenizeUrl(tokenizedBytes);
	}

	const compressedBytes = urlDecode(data);
	const decompressed: Uint8Array = await decompress(compressedBytes);

	return textDecoder.decode(decompressed);
}

/**
 * Compresses a string with Brotli + encodes using Base64.
 * When a password is provided, the encoded payload is encrypted with AES-GCM.
 */
export async function encode(input: string, password?: string): Promise<string> {
	const plain = await encodePlain(input);
	if (!password) return plain;

	const encrypted = await encryptWithPassword(textEncoder.encode(plain), password);
	return `${PASSWORD_PREFIX}${urlEncode(encrypted)}`;
}

/**
 * Decodes from Base64 + decompresses with Brotli back to the original string.
 * When the payload is password-protected, a password must be supplied.
 */
export async function decode(data: string, password?: string): Promise<string> {
	if (data.startsWith(PASSWORD_PREFIX)) {
		if (!password) {
			throw new Error('Password required to decode this link.');
		}

		const encryptedBytes = urlDecode(data.slice(PASSWORD_PREFIX.length));
		const decrypted = await decryptWithPassword(encryptedBytes, password);
		const unwrapped = textDecoder.decode(decrypted);
		return decodePlain(unwrapped);
	}

	return decodePlain(data);
}
