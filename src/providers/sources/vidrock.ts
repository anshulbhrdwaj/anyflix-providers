import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { createM3U8ProxyUrl } from '@/utils/proxy';

// --- Configuration ---
const SECRET_KEY_STRING = 'x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9';
const BACKEND_API_URL = 'https://vidrock.net/api';

const blacklisted = [''];

const HEADERS = {
  Origin: 'https://vidrock.net',
  Referer: 'https://vidrock.net',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// --- Helper: PKCS7 Padding ---
// Node's createCipheriv does this automatically. Web Crypto does not.
function pkcs7Pad(data: Uint8Array): Uint8Array {
  const blockSize = 16;
  const padding = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  padded.fill(padding, data.length);
  return padded;
}

// --- Helper: ArrayBuffer to URL-Safe Base64 ---
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is global in Node.js 16+ and Browsers
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Main Encryption Function ---
const generateEncryptedPath = async (
  id: string | number,
  type: 'tv' | 'movie',
  season?: string | number,
  episode?: string | number,
): Promise<string> => {
  const payload = type === 'tv' ? `${id}_${season}_${episode}` : `${id}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_KEY_STRING);
  const iv = encoder.encode(SECRET_KEY_STRING.substring(0, 16));
  const data = encoder.encode(payload);

  // 1. Import the key (Casted to BufferSource to satisfy TS)
  const key = await crypto.subtle.importKey('raw', keyData as BufferSource, { name: 'AES-CBC' }, false, ['encrypt']);

  // 2. Pad the data
  const paddedData = pkcs7Pad(data);

  // 3. Encrypt (Casted to BufferSource to satisfy TS)
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    key,
    paddedData as BufferSource,
  );

  // 4. Convert to URL-safe Base64
  const urlSafe = arrayBufferToBase64Url(encryptedBuffer);

  return `${BACKEND_API_URL}/${type}/${urlSafe}`;
};
// --- Interfaces ---
interface VidrockSource {
  url: string | null;
  language: string | null;
  flag: string | null;
}

interface VidrockResponse {
  [serverName: string]: VidrockSource;
}

// --- Main Scraper Logic ---
async function scrape(ctx: MovieScrapeContext | ShowScrapeContext): Promise<SourcererOutput> {
  const type = ctx.media.type;

  // 1. Generate encrypted URL (Now Async)
  let apiUrl: string;
  if (type === 'movie') {
    apiUrl = await generateEncryptedPath(ctx.media.tmdbId, 'movie');
  } else {
    apiUrl = await generateEncryptedPath(ctx.media.tmdbId, 'tv', ctx.media.season.number, ctx.media.episode.number);
  }

  // 2. Fetch Data
  const response = await ctx.proxiedFetcher<VidrockResponse>(apiUrl, {
    headers: HEADERS,
  });

  if (!response) throw new Error('No response from Vidrock API');

  // 3. Build Streams Array
  const stream: SourcererOutput['stream'] = [];

  const headers = {
    Origin: 'https://vidrock.net',
    Referer: 'https://vidrock.net',
  };

  for (const [serverName, data] of Object.entries(response)) {
    if (!data || !data.url) continue;
    if (blacklisted.includes(serverName.toLowerCase())) continue;

    stream.push({
      id: `vidrock-${serverName.toLowerCase()}`,
      type: 'hls',
      playlist: createM3U8ProxyUrl(data.url, ctx.features, headers),
      flags: [flags.CORS_ALLOWED],
      captions: [],
      headers,
    });
  }

  return {
    embeds: [],
    stream,
  };
}

// --- Export ---
export const vidrockScraper = makeSourcerer({
  id: 'vidrock',
  name: 'Vidrock',
  rank: 202,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: scrape,
  scrapeShow: scrape,
});
