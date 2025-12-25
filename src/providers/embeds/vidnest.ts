import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

const PASSPHRASE = 'T8c8PQlSQVU4mBuW4CbE/g57VBbM5009QHd+ym93aZZ5pEeVpToY6OdpYPvRMVYp';

async function decryptVidnestData(encryptedBase64: string): Promise<any> {
  // Decode base64 to get encrypted bytes
  const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  // Extract IV (first 12 bytes), ciphertext (middle), and auth tag (last 16 bytes)
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12, -16);
  const tag = encryptedBytes.slice(-16);

  // Create key from passphrase (decode base64 first, then take first 32 bytes)
  const keyData = Uint8Array.from(atob(PASSPHRASE), (c) => c.charCodeAt(0)).slice(0, 32);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

  // Combine ciphertext and tag for decryption
  const encrypted = new Uint8Array([...ciphertext, ...tag]);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

    const decryptedText = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedText);
  } catch (error) {
    throw new NotFoundError('Failed to decrypt data');
  }
}

export const vidnestHollymoviehdEmbed = makeEmbed({
  id: 'vidnest-hollymoviehd',
  name: 'Vidnest HollyMovie',
  rank: 104,
  flags: [],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url);
    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData.success && !decryptedData.sources) throw new NotFoundError('No streams found');

    const sources = decryptedData.sources || decryptedData.streams;
    const streams: HlsBasedStream[] = [];

    const streamHeaders = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.5',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      origin: 'https://flashstream.cc',
      referer: 'https://flashstream.cc/',
    };

    for (const source of sources) {
      if (source.file && (source.file.includes('pkaystream.cc') || source.file.includes('flashstream.cc'))) {
        streams.push({
          id: `hollymoviehd-${source.label || 'default'}`,
          type: 'hls',
          playlist: createM3U8ProxyUrl(source.file, ctx.features, streamHeaders),
          flags: [],
          captions: [],
          headers: streamHeaders,
        } as HlsBasedStream);
      }
    }

    return {
      stream: streams,
    };
  },
});

export const vidnestAllmoviesEmbed = makeEmbed({
  id: 'vidnest-allmovies',
  name: 'Vidnest AllMovies (Hindi)',
  rank: 103,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url);
    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData.success && !decryptedData.streams) throw new NotFoundError('No streams found');

    const sources = decryptedData.sources || decryptedData.streams;
    const streams = [];

    const streamHeaders = {
      Origin: 'https://vidnest.fun',
      Referer: 'https://vidnest.fun',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // const vdrkHeaders = {
    // Origin: 'https://vidrock.net',
    // Referer: 'https://vidrock.net',
    // 'User-Agent':
    //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // };

    for (const stream of sources) {
      streams.push({
        id: `allmovies-${stream.language || 'default'}`,
        type: 'hls',
        playlist: stream.url || stream.file,
        flags: [],
        captions: [],
        headers: streamHeaders,
      } as HlsBasedStream);
    }

    return {
      stream: streams,
    };
  },
});
