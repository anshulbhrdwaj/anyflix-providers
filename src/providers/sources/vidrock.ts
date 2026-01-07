import { createCipheriv } from 'crypto';

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

// --- Encryption Logic (Node Native) ---
function encryptPayload(payload: string): string {
  // Key length is 32 characters (256 bits), so we use aes-256-cbc
  const key = Buffer.from(SECRET_KEY_STRING, 'utf-8');
  const iv = Buffer.from(SECRET_KEY_STRING.substring(0, 16), 'utf-8');

  // Node.js handles PKCS7 padding automatically by default
  const cipher = createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(payload, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Convert to URL-Safe Base64
  return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Path Generator ---
const generateEncryptedPath = (
  id: string | number,
  type: 'tv' | 'movie',
  season?: string | number,
  episode?: string | number,
): string => {
  const payload = type === 'tv' ? `${id}_${season}_${episode}` : `${id}`;
  const urlSafe = encryptPayload(payload);
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

  // 1. Generate encrypted URL (Synchronous)
  let apiUrl: string;
  if (type === 'movie') {
    apiUrl = generateEncryptedPath(ctx.media.tmdbId, 'movie');
  } else {
    apiUrl = generateEncryptedPath(ctx.media.tmdbId, 'tv', ctx.media.season.number, ctx.media.episode.number);
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
