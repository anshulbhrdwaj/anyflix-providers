import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

const BASE_URL = 'https://vidfast.pro';

// UPDATED: Use the exact User-Agent from your working network dump
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0';

const CSRF_TOKEN = 'ZKMMHgeKju4dmmn6cnm7N63HMaGRRIZx';

// 1. Headers for the API scraping (Needs CSRF, X-Requested-With)
const API_HEADERS = {
  Accept: '*/*',
  Referer: BASE_URL,
  Origin: BASE_URL,
  'User-Agent': USER_AGENT,
  'X-Csrf-Token': CSRF_TOKEN,
  'X-Requested-With': 'XMLHttpRequest',
};

// 2. Headers for the HLS Stream (Strictly what the player uses)
const STREAM_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.5',
  // 'Accept-Encoding': 'gzip, deflate, br, zstd', // Let the proxy/fetcher handle negotiation to avoid decode errors
  Referer: 'https://vidfast.pro/', // Note the trailing slash
  Origin: 'https://vidfast.pro', // No trailing slash
  'Sec-GPC': '1',
  Connection: 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

async function scrapeVidFastEmbed(ctx: any) {
  // 1. Scrape the JSON using API headers
  const response = await ctx.proxiedFetcher(ctx.url, {
    headers: API_HEADERS,
  });

  let json = response;
  if (typeof response === 'string') {
    try {
      json = JSON.parse(response);
    } catch {
      throw new NotFoundError('Invalid JSON response');
    }
  }

  if (!json || !json.url) {
    throw new NotFoundError('Empty or invalid stream response');
  }

  const captions = [];
  if (Array.isArray(json.tracks)) {
    for (const track of json.tracks) {
      if (track.file && track.label) {
        captions.push({
          id: track.label,
          url: track.file,
          language: track.label,
          type: 'vtt',
          hasCorsRestrictions: false,
        });
      }
    }
  }

  // 2. Generate Proxy URL using STREAM_HEADERS
  // This passes the headers to the proxy, which then passes them to the upstream
  const proxyUrl = createM3U8ProxyUrl(json.url, ctx.features, STREAM_HEADERS);

  // eslint-disable-next-line no-console
  // console.log('Proxy URL', proxyUrl);

  return {
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: proxyUrl,
        headers: STREAM_HEADERS,
        flags: [flags.CORS_ALLOWED],
        captions,
      } as HlsBasedStream,
    ],
  };
}

const makeVidFastEmbed = (name: string, rank: number) =>
  makeEmbed({
    id: `vidfast-${name.toLowerCase()}`,
    name: `VidFast ${name}`,
    rank,
    flags: [flags.CORS_ALLOWED],
    disabled: false,
    scrape: scrapeVidFastEmbed,
  });

export const vidfastOscarEmbed = makeVidFastEmbed('Oscar', 230);
export const vidfastAlphaEmbed = makeVidFastEmbed('Alpha', 231);
export const vidfastBetaEmbed = makeVidFastEmbed('Beta', 232);
export const vidfastVfastEmbed = makeVidFastEmbed('vFast', 233);
export const vidfastBornEmbed = makeVidFastEmbed('Stream', 234);
