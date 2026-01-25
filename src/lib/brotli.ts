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

/**
 * Brotli custom dictionary.
 */
const URL_DICTIONARY = ['/', '?', '&', '=', '#', '%', '+', '-', '_', '~', '@', ':', '.'].join('\n');

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

/**
 * Tokens are the *format* (compact markers), so keep them curated and high-impact.
 * Let the dictionary handle the long tail.
 */
const TOKEN_STRINGS = [
	// Schemes / common prefixes
	'https://www.',
	'http://www.',
	'https://',
	'http://',
	'//',
	'www.',
	'://',
	'/?',

	// Common separators / fragments
	'/',
	'?',
	'&',
	'=',
	'#',
	'#/',

	// Common TLDs (small, high-frequency set)
	'.com',
	'.org',
	'.net',
	'.io',
	'.co',
	'.dev',
	'.app',
	'.ai',
	'.me',
	'.tv',
	'.to',
	'.us',
	'.uk',
	'.de',
	'.fr',
	'.jp',

	// Structural host / infra patterns
	'api.',
	'cdn.',
	'static.',
	'assets.',
	'media.',
	'img.',
	'm.',
	'blog.',
	'news.',
	'shop.',
	'store.',

	// Tracking / query keys (ecosystem-wide)
	'utm_source=',
	'utm_medium=',
	'utm_campaign=',
	'utm_content=',
	'utm_term=',
	'utm_id=',
	'utm_',
	'&utm_source=',
	'&utm_medium=',
	'ref=',
	'source=',
	'fbclid=',
	'gclid=',
	'id=',
	'sid=',
	'lang=',
	'page=',
	'&page=',
	'q=',
	's=',
	't=',
	'v=',
	'type=',
	'mode=',
	'redirect=',
	'redirect_uri=',
	'return=',
	'callback=',
	'state=',
	'&state=',
	'code=',
	'scope=',
	'client_id=',
	'&client_id=',
	'token=',
	'&token=',
	'session=',
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

	// Common paths (framework / repo / API heavy)
	'assets/',
	'static/',
	'images/',
	'img/',
	'css/',
	'js/',
	'fonts/',
	'media/',
	'/api/',
	'/v1/',
	'/v2/',
	'/v3/',
	'/v4/',
	'/auth/',
	'/login/',
	'/logout/',
	'/callback/',
	'/oauth/',
	'/users/',
	'/posts/',
	'/comments/',
	'/tags/',
	'/search/',
	'/settings/',

	// Common files / extensions
	'index.html',
	'robots.txt',
	'sitemap.xml',
	'favicon.ico',
	'.html',
	'.php',
	'.js',
	'.css'
];

const TOKEN_BYTES = TOKEN_STRINGS.map((token) => textEncoder.encode(token));

/**
 * Trie for O(n) longest-prefix matching.
 */
type TrieNode = {
	next: Map<string, TrieNode>;
	tokenIndex: number | null;
};

function makeTrieNode(): TrieNode {
	return { next: new Map(), tokenIndex: null };
}

function buildTokenTrie(tokens: string[]): TrieNode {
	const root = makeTrieNode();

	for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
		const token = tokens[tokenIndex];
		let node = root;

		for (let j = 0; j < token.length; j++) {
			const ch = token[j];
			let child = node.next.get(ch);
			if (!child) {
				child = makeTrieNode();
				node.next.set(ch, child);
			}
			node = child;
		}

		node.tokenIndex = tokenIndex;
	}

	return root;
}

const TOKEN_TRIE = buildTokenTrie(TOKEN_STRINGS);

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

/**
 * Tokenize a URL into a byte stream:
 * - tokens become single bytes in [0x80..)
 * - all other bytes are UTF-8, with escaping for 0x7f and >= 0x80
 */
function tokenizeUrl(input: string): Uint8Array {
	const out: number[] = [];
	let i = 0;

	while (i < input.length) {
		// Longest trie match starting at i
		let node: TrieNode | undefined = TOKEN_TRIE;
		let j = i;

		let bestTokenIndex: number | null = null;
		let bestEnd = i;

		while (node && j < input.length) {
			const ch = input[j];
			node = node.next.get(ch);
			if (!node) break;

			j += 1;

			if (node.tokenIndex !== null) {
				bestTokenIndex = node.tokenIndex;
				bestEnd = j;
			}
		}

		if (bestTokenIndex !== null) {
			out.push(TOKEN_BASE + bestTokenIndex);
			i = bestEnd;
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
 * Compresses a string with Brotli + encodes using Base64 (url-safe).
 * Chooses the smallest representation among several candidates.
 */
async function encodePlain(input: string): Promise<string> {
	const inputBytes = textEncoder.encode(input);
	const tokenizedBytes = tokenizeUrl(input);

	const [withDict, withoutDict, tokenizedWithDict, tokenizedWithoutDict] = await Promise.all([
		compressWithDictionary(inputBytes),
		compress(inputBytes, { quality: 11 }),
		compressWithDictionary(tokenizedBytes),
		compress(tokenizedBytes, { quality: 11 })
	]);

	// Baseline: compressed (dict or not) without prefix.
	const bestCompressed = withDict.length <= withoutDict.length ? withDict : withoutDict;
	const compressedEncoded = urlEncode(bestCompressed);

	// Choose best tokenized compressed (dict or not) without prefix.
	const bestTokenzied =
		tokenizedWithDict.length <= tokenizedWithoutDict.length
			? tokenizedWithDict
			: tokenizedWithoutDict;

	// Tokenized variants have prefixes.
	const tokenizedCompressedCandidate = `${TOKEN_PREFIX}${urlEncode(bestTokenzied)}`;
	const tokenizedRawCandidate = `${TOKEN_RAW_PREFIX}${urlEncode(tokenizedBytes)}`;

	// Raw UTF-8 with prefix (no compression).
	const rawCandidate = `${RAW_PREFIX}${urlEncode(inputBytes)}`;

	let best = compressedEncoded;

	// Debug
	// console.log(
	// 	`Compressed: ${compressedEncoded.length}\n`,
	// 	`Tokenized Compressed: ${tokenizedCompressedCandidate.length}\n`,
	// 	`Tokenized Raw: ${tokenizedRawCandidate.length}\n`,
	// 	`Raw: ${rawCandidate.length}`
	// );

	if (tokenizedCompressedCandidate.length < best.length) best = tokenizedCompressedCandidate;
	if (tokenizedRawCandidate.length < best.length) best = tokenizedRawCandidate;
	if (rawCandidate.length < best.length) best = rawCandidate;

	return best;
}

/**
 * Decodes back to the original string.
 */
async function decodePlain(data: string): Promise<string> {
	if (data.startsWith(RAW_PREFIX)) {
		const rawBytes = urlDecode(data.slice(RAW_PREFIX.length));
		return textDecoder.decode(rawBytes);
	}

	if (data.startsWith(TOKEN_PREFIX)) {
		const compressedBytes = urlDecode(data.slice(TOKEN_PREFIX.length));
		const decompressed: Uint8Array = await decompress(compressedBytes);
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
 * Compress + encode.
 * If a password is provided, the encoded payload is encrypted with AES-GCM (PBKDF2 key derivation).
 */
export async function encode(input: string, password?: string): Promise<string> {
	const plain = await encodePlain(input);
	if (!password) return plain;

	const encrypted = await encryptWithPassword(textEncoder.encode(plain), password);
	return `${PASSWORD_PREFIX}${urlEncode(encrypted)}`;
}

/**
 * Decode.
 * If the payload is password-protected, a password must be supplied.
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
