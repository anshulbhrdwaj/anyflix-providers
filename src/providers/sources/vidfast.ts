import { createCipheriv } from 'crypto';

import { flags } from '@/entrypoint/utils/targets';
import { makeSourcerer } from '@/providers/base';
import { NotFoundError } from '@/utils/errors';

// --- Constants ---
const BASE_URL = 'https://vidfast.pro';
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
const MAGIC_PATH =
  'hezushon/n/d317d142/1000096011347568/tu/bc8f618c-010c-541c-afe3-88015b52befb/APA91ev5DWZmu1RhoBHIAvVYmx2E_HahZM69QtFz-kRbGhVW6D_4jBHrWqfKJ17UIhtga5xu9E1kCVChTX_xXZfXjxSjLoayH-caHoWnAqubhRFBQyMFiZAyROPUQizVZCPMDpwSLbGh4AumTZ-3Mfg5O5S0Bykk9c8RXZ0YvuHkuOo_Hmz8G4F';
const CSRF_TOKEN = 'ZKMMHgeKju4dmmn6cnm7N63HMaGRRIZx';

const HEADERS = {
  Accept: '*/*',
  Referer: BASE_URL,
  Origin: BASE_URL,
  'User-Agent': USER_AGENT,
  'X-Csrf-Token': CSRF_TOKEN,
  'X-Requested-With': 'XMLHttpRequest',
};

// --- Crypto Keys ---
const AES_KEY_HEX = '7d4b4c48bcbf64da1e3b154ae4bdb6d4ae7454cb3dd5fba4bea6b45dcbac3a62';
const AES_IV_HEX = 'd7c0ddcb324b7dd86e1d2226f40e9d02';
// The original snippet had a trailing '6' ('...f16') which regex ignored.
// We remove it here to be explicit: ending in 'f1'
const XOR_KEY_HEX = '667752e68b371978f1';

// --- Helper Functions ---

function customEncode(input: Uint8Array): string {
  // 1. Standard Base64 encode
  const b64 = Buffer.from(input).toString('base64');

  // 2. Replacements per snippet
  const safeB64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // 3. Custom Alphabet Substitution
  const standardAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
  const customAlphabet = 'ufH91AEt0Q45Tbp2J-wUDxFykdVjYWzZPlNvhG8ri6Rec7MLOqsKBnCagm3I_oXS';
  const map = new Map<string, string>();
  for (let i = 0; i < standardAlphabet.length; i++) {
    map.set(standardAlphabet[i], customAlphabet[i]);
  }

  return safeB64
    .split('')
    .map((char) => map.get(char) || char)
    .join('');
}

function xorData(data: Uint8Array, keyHex: string): Uint8Array {
  const keyBytes = Buffer.from(keyHex, 'hex');
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

function generateHash(inputString: string): string {
  // 1. AES Encrypt
  const key = Buffer.from(AES_KEY_HEX, 'hex');
  const iv = Buffer.from(AES_IV_HEX, 'hex');
  const cipher = createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(inputString, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // 2. XOR (CORRECTION: XOR the RAW ciphertext bytes, not the Base64 string bytes)
  // The original snippet parsed the Base64 back to bytes before XORing.
  // Since 'encrypted' is already a Buffer (Uint8Array), we use it directly.
  const xored = xorData(encrypted, XOR_KEY_HEX);

  // 3. Custom Encode
  return customEncode(xored);
}

const serverMap: Record<string, string> = {
  Oscar: 'oscar',
  Alpha: 'alpha',
  vFast: 'vfast',
  Iron: 'iron',
  Beta: 'beta',
  Cobra: 'cobra',
  Delta: 'delta',
  Viper: 'viper',
  Ranger: 'ranger',
  Specter: 'specter',
  Echo: 'echo',
  Vodka: 'vodka',
  Pablo: 'pablo',
  Loco: 'loco',
  Samba: 'samba',
  Bollywood: 'bollywood',
  Kirito: 'kirito',
  Meliodas: 'meliodas',
};

async function scrapeVidFast(ctx: any) {
  const { media } = ctx;
  const isMovie = media.type === 'movie';

  // 1. Construct Page URL
  const pageUrl = isMovie
    ? `${BASE_URL}/movie/${media.tmdbId}`
    : `${BASE_URL}/tv/${media.tmdbId}/${media.season.number}/${media.episode.number}`;

  // 2. Fetch Page
  const pageHtml = await ctx.proxiedFetcher(pageUrl, {
    headers: {
      Referer: BASE_URL,
      'User-Agent': USER_AGENT,
    },
  });

  // 3. Extract Token 'en'
  // We use a regex that matches the escaped JSON structure usually found in the page source
  const match = pageHtml.match(/\\"en\\":\\"(.*?)\\"/);
  if (!match) throw new NotFoundError('No data found in VidFast page');
  const token = match[1];

  // 4. Generate Hash
  const hash = generateHash(token);

  // 5. Fetch Streaming Servers
  const apiUrl = `${BASE_URL}/${MAGIC_PATH}/u2Dg1A/${hash}`;
  const response = await ctx.proxiedFetcher(apiUrl, {
    headers: HEADERS,
  });

  if (!response || !Array.isArray(response) || response.length === 0) {
    throw new NotFoundError('No streaming servers found');
  }

  // 6. Map to Embeds
  return {
    embeds: response.map((server: any) => {
      const serverId = serverMap[server.name] || 'stream';
      return {
        embedId: `vidfast-${serverId}`,
        url: `${BASE_URL}/${MAGIC_PATH}/CtJq/${server.data}`,
      };
    }),
  };
}

export const vidfastScraper = makeSourcerer({
  id: 'vidfast',
  name: 'VidFast',
  rank: 220,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  scrapeMovie: scrapeVidFast,
  scrapeShow: scrapeVidFast,
});
