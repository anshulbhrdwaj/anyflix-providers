// /* eslint-disable no-console */
import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

const DECRYPT_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Referer: 'https://videasy.net/',
  Connection: 'keep-alive',
};

async function getDecryptedData(ctx: any, encryptedUrl: string): Promise<any> {
  // console.log(`\n[Videasy] 1. Fetching encrypted data from: ${encryptedUrl}`);

  const encryptedRes = await ctx.proxiedFetcher.full(encryptedUrl, {
    headers: HEADERS,
  });

  if (encryptedRes.statusCode !== 200 || !encryptedRes.body) {
    console.error('[Videasy] Failed to fetch encrypted data');
    throw new NotFoundError('Failed to fetch encrypted data from Videasy');
  }

  const encryptedText =
    typeof encryptedRes.body === 'object' ? JSON.stringify(encryptedRes.body) : String(encryptedRes.body);

  const urlObj = new URL(encryptedUrl);
  const tmdbId = urlObj.searchParams.get('tmdbId');

  if (!tmdbId) {
    throw new NotFoundError('TMDB ID missing in URL');
  }

  // console.log(`[Videasy] 2. Sending to Decryption API (TMDB: ${tmdbId})`);

  const decryptRes = await ctx.proxiedFetcher.full(DECRYPT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...HEADERS,
    },
    body: JSON.stringify({
      text: encryptedText,
      id: tmdbId,
    }),
  });

  if (decryptRes.statusCode !== 200) {
    console.error(`[Videasy] Decryption API failed with status ${decryptRes.statusCode}`);
    throw new NotFoundError('Decryption API failed');
  }

  let json;
  try {
    if (typeof decryptRes.body === 'string') {
      json = JSON.parse(decryptRes.body);
    } else {
      json = decryptRes.body;
    }
  } catch (e) {
    console.error('[Videasy] Failed to parse decryption response');
    throw new NotFoundError('Failed to parse decryption API response');
  }

  return json.result;
}

function makeVideasyEmbed(serverId: string, serverName: string, rank: number) {
  return makeEmbed({
    id: `videasy-${serverId}`,
    name: `Videasy ${serverName}`,
    rank,
    flags: [flags.CORS_ALLOWED],
    disabled: false,
    async scrape(ctx) {
      try {
        const decryptedData = await getDecryptedData(ctx, ctx.url);

        // console.log('[Videasy] Decrypted Payload:', JSON.stringify(decryptedData, null, 2));

        let sources: any[] = [];

        // Prioritize 'url' based on your logs, fallback to 'file'
        if (decryptedData.sources) {
          sources = decryptedData.sources;
        } else if (decryptedData.file) {
          sources = [{ url: decryptedData.file, label: 'Auto' }];
        } else if (decryptedData.url) {
          sources = [{ url: decryptedData.url, label: 'Auto' }];
        } else if (Array.isArray(decryptedData)) {
          sources = decryptedData;
        }

        if (!sources || sources.length === 0) {
          console.warn(`[Videasy] No sources found for ${serverName}`);
          throw new NotFoundError('No sources found in decrypted data');
        }

        const validStream = sources.find((s: any) => {
          const url = s.url || s.file;
          if (!url) return false;
          return url.includes('.m3u8') || s.type === 'hls';
        });

        if (!validStream) {
          console.warn(`[Videasy] No valid HLS stream found for ${serverName}.`);
          throw new NotFoundError('No valid HLS stream found');
        }

        const streamUrl = validStream.url || validStream.file;
        // console.log(`[Videasy] Found stream: ${streamUrl}`);

        // Handle subtitles (checking 'subtitles' array from logs, fallback to 'tracks')
        const subtitles = (decryptedData.subtitles || decryptedData.tracks || []).map((t: any) => ({
          url: t.url || t.file,
          lang: t.lang || t.language || t.label || 'Unknown',
          label: t.label || t.lang || t.language || 'Unknown',
        }));

        const proxiedUrl = createM3U8ProxyUrl(streamUrl, ctx.features, HEADERS);
        // console.log(proxiedUrl);
        return {
          stream: [
            {
              id: `videasy-${serverId}-auto`,
              type: 'hls',
              // Use Proxy to ensure headers are attached
              playlist: proxiedUrl,
              flags: [flags.CORS_ALLOWED],
              captions: subtitles,
              headers: HEADERS,
            } as HlsBasedStream,
          ],
        };
      } catch (error) {
        console.error(`[Videasy ${serverName}] Error:`, error);
        throw error;
      }
    },
  });
}

export const videasyNeonEmbed = makeVideasyEmbed('neon', 'Neon', 240);
export const videasySageEmbed = makeVideasyEmbed('sage', 'Sage', 241);
export const videasyCypherEmbed = makeVideasyEmbed('cypher', 'Cypher', 242);
export const videasyYoruEmbed = makeVideasyEmbed('yoru', 'Yoru', 243);
export const videasyReynaEmbed = makeVideasyEmbed('reyna', 'Reyna', 244);
export const videasyOmenEmbed = makeVideasyEmbed('omen', 'Omen', 245);
export const videasyBreachEmbed = makeVideasyEmbed('breach', 'Breach', 246);
export const videasyVyseEmbed = makeVideasyEmbed('vyse', 'Vyse', 247);
export const videasyKilljoyEmbed = makeVideasyEmbed('killjoy', 'Killjoy', 248);
export const videasyHarborEmbed = makeVideasyEmbed('harbor', 'Harbor', 249);
export const videasyChamberEmbed = makeVideasyEmbed('chamber', 'Chamber', 250);
export const videasyFadeEmbed = makeVideasyEmbed('fade', 'Fade', 251);
export const videasyGekkoEmbed = makeVideasyEmbed('gekko', 'Gekko', 252);
export const videasyKayoEmbed = makeVideasyEmbed('kayo', 'Kayo', 253);
export const videasyRazeEmbed = makeVideasyEmbed('raze', 'Raze', 254);
export const videasyPhoenixEmbed = makeVideasyEmbed('phoenix', 'Phoenix', 255);
export const videasyAstraEmbed = makeVideasyEmbed('astra', 'Astra', 256);
