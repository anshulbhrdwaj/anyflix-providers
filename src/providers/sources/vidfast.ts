import CryptoJS from 'crypto-js'; // Make sure to install: pnpm add crypto-js @types/crypto-js

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
const XOR_KEY_HEX = '667752e68b371978f1';

// --- Helper Functions ---

// Convert CryptoJS WordArray to Uint8Array for XOR operations
function wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    u8[i] = byte;
  }
  return u8;
}

function xorData(data: Uint8Array, keyHex: string): Uint8Array {
  // Convert hex key to bytes manually or via CryptoJS then to Uint8Array
  // Simple manual conversion for the key:
  const keyBytes = new Uint8Array(keyHex.length / 2);
  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes[i / 2] = parseInt(keyHex.substring(i, i + 2), 16);
  }

  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

function customEncode(input: Uint8Array): string {
  // 1. Convert Uint8Array to Binary String for btoa
  let binary = '';
  const len = input.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(input[i]);
  }

  // 2. Base64 Encode (Universal btoa)
  const b64 = btoa(binary);

  // 3. Replacements
  const safeB64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // 4. Custom Alphabet Substitution
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

function generateHash(inputString: string): string {
  // 1. AES Encrypt
  const key = CryptoJS.enc.Hex.parse(AES_KEY_HEX);
  const iv = CryptoJS.enc.Hex.parse(AES_IV_HEX);

  const encrypted = CryptoJS.AES.encrypt(inputString, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // 2. Get Raw Ciphertext Bytes (WordArray -> Uint8Array)
  const ciphertextBytes = wordArrayToUint8Array(encrypted.ciphertext);

  // 3. XOR
  const xored = xorData(ciphertextBytes, XOR_KEY_HEX);

  // 4. Custom Encode
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

  const pageUrl = isMovie
    ? `${BASE_URL}/movie/${media.tmdbId}`
    : `${BASE_URL}/tv/${media.tmdbId}/${media.season.number}/${media.episode.number}`;

  const pageHtml = await ctx.proxiedFetcher(pageUrl, {
    headers: {
      Referer: BASE_URL,
      'User-Agent': USER_AGENT,
    },
  });

  const match = pageHtml.match(/\\"en\\":\\"(.*?)\\"/);
  if (!match) throw new NotFoundError('No data found in VidFast page');
  const token = match[1];

  const hash = generateHash(token);

  const apiUrl = `${BASE_URL}/${MAGIC_PATH}/u2Dg1A/${hash}`;
  const response = await ctx.proxiedFetcher(apiUrl, {
    headers: HEADERS,
  });

  if (!response || !Array.isArray(response) || response.length === 0) {
    throw new NotFoundError('No streaming servers found');
  }

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
