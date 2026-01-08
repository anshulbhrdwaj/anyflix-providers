import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';

const BASE_URL = 'https://vidfast.pro';
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
const CSRF_TOKEN = 'ZKMMHgeKju4dmmn6cnm7N63HMaGRRIZx';

const HEADERS = {
  Accept: '*/*',
  Referer: BASE_URL,
  Origin: BASE_URL,
  'User-Agent': USER_AGENT,
  'X-Csrf-Token': CSRF_TOKEN,
  'X-Requested-With': 'XMLHttpRequest',
};

// Generic function to scrape any VidFast embed
async function scrapeVidFastEmbed(ctx: any) {
  // ctx.url is the ".../CtJq/..." URL constructed in the source scraper
  const response = await ctx.proxiedFetcher(ctx.url, {
    headers: HEADERS,
  });

  // Handle String or Object response
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
          language: track.label, // You can add a language mapper here if needed
          type: 'vtt',
          hasCorsRestrictions: false,
        });
      }
    }
  }

  return {
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: json.url,
        headers: {
          Origin: 'https://vidfast.pro',
          Referer: 'https://vidfast.pro/',
        },
        flags: [flags.CORS_ALLOWED],
        captions,
      } as HlsBasedStream,
    ],
  };
}

// Helper to make embed definitions easily
const makeVidFastEmbed = (name: string, rank: number) =>
  makeEmbed({
    id: `vidfast-${name.toLowerCase()}`,
    name: `VidFast ${name}`,
    rank,
    flags: [flags.CORS_ALLOWED],
    disabled: false,
    scrape: scrapeVidFastEmbed,
  });

// Export specific embeds for the servers you care about
// You can add as many as you like from the 'serverMap' list
export const vidfastOscarEmbed = makeVidFastEmbed('Oscar', 230);
export const vidfastAlphaEmbed = makeVidFastEmbed('Alpha', 231);
export const vidfastBetaEmbed = makeVidFastEmbed('Beta', 232);
export const vidfastVfastEmbed = makeVidFastEmbed('vFast', 233);
export const vidfastBornEmbed = makeVidFastEmbed('Stream', 234); // Fallback generic
