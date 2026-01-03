import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

const PASSPHRASE = 'T8c8PQlSQVU4mBuW4CbE/g57VBbM5009QHd+ym93aZZ5pEeVpToY6OdpYPvRMVYp';

const vidnestHeaders = {
  Origin: 'https://vidnest.fun',
  Referer: 'https://vidnest.fun/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
  'X-Requested-With': 'XMLHttpRequest',
};

async function decryptVidnestData(encryptedBase64: string): Promise<any> {
  const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12, -16);
  const tag = encryptedBytes.slice(-16);

  const keyData = Uint8Array.from(atob(PASSPHRASE), (c) => c.charCodeAt(0)).slice(0, 32);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
  const encrypted = new Uint8Array([...ciphertext, ...tag]);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const decryptedText = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedText);
  } catch (error) {
    throw new NotFoundError('Failed to decrypt data');
  }
}

async function createFlixHQStream(decryptedData: any, embedId: string, ctx: any): Promise<HlsBasedStream> {
  const subtitles = (decryptedData.subtitles || []).map((s: any) => ({
    url: s.url,
    lang: s.lang || 'Unknown',
    label: s.label || 'Unknown',
    default: !!s.default,
  }));

  // Method 1: Double proxy (recommended)
  const firstProxyHeaders = {
    Referer: 'https://videostr.net/',
  };

  const firstProxyUrl = `https://proxy2.aether.mom/proxy?url=${encodeURIComponent(
    decryptedData.url,
  )}&headers=${encodeURIComponent(JSON.stringify(firstProxyHeaders))}`;

  const finalStreamHeaders = {
    Referer: 'https://vidnest.fun',
    Origin: 'https://vidnest.fun',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  return {
    id: `${embedId}-auto`,
    type: 'hls',
    playlist: createM3U8ProxyUrl(firstProxyUrl, ctx.features, finalStreamHeaders),
    flags: [],
    captions: subtitles,
    headers: finalStreamHeaders,
  } as HlsBasedStream;
}

// Lamda embed - English streams (uses rogflix backend)
export const vidnestLamdaEmbed = makeEmbed({
  id: 'vidnest-lamda',
  name: 'Vidnest Lamda',
  rank: 105,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });
    // console.log('Lamda Response:', response);

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    const streams = Array.isArray(decryptedData.streams) ? decryptedData.streams : [];
    if (!streams.length) throw new NotFoundError('Lamda: no streams');

    const englishStream = streams.find((s: any) => (s?.language || '').toLowerCase() === 'english');
    if (!englishStream?.url) throw new NotFoundError('Lamda: English stream not available');

    return {
      stream: [
        {
          id: 'lamda-english',
          type: 'hls',
          playlist: englishStream.url,
          flags: [],
          captions: decryptedData.subtitles || [],
        } as HlsBasedStream,
      ],
    };
  },
});

// Alfa embed (uses primesrc backend)
export const vidnestAlfaEmbed = makeEmbed({
  id: 'vidnest-alfa',
  name: 'Vidnest Alfa',
  rank: 106,
  flags: [],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!Array.isArray(decryptedData.sources) || !decryptedData.sources.length) {
      throw new NotFoundError('No valid streams found');
    }

    const validSources = decryptedData.sources.filter(
      (s: any) =>
        s.url &&
        (s.isM3U8 === true ||
          s.url.includes('.m3u8') ||
          s.url.includes('/hls/') ||
          s.url.includes('master') ||
          s.url.includes('.txt')),
    );

    if (!validSources.length) throw new NotFoundError('Alfa: No valid sources found');

    const streams: HlsBasedStream[] = [];
    const streamHeaders = vidnestHeaders;

    for (const source of validSources) {
      const isM3U8 =
        !source.url.includes('.txt') &&
        (source.isM3U8 === true || source.url.includes('.m3u8') || source.url.includes('/hls/'));

      const finalUrl = createM3U8ProxyUrl(source.url, ctx.features, streamHeaders);

      streams.push({
        id: `alfa-${source.quality || 'auto'}`,
        type: 'hls',
        playlist: finalUrl,
        flags: [],
        captions: decryptedData.subtitles || [],
        headers: isM3U8 ? streamHeaders : undefined,
      } as HlsBasedStream);
    }

    streams.sort((a, b) => {
      const aIsTxt = a.playlist.includes('.txt');
      const bIsTxt = b.playlist.includes('.txt');
      if (aIsTxt && !bIsTxt) return -1;
      if (!aIsTxt && bIsTxt) return 1;

      const aIsIP = /\/\/\d+\.\d+\.\d+\.\d+/.test(a.playlist);
      const bIsIP = /\/\/\d+\.\d+\.\d+\.\d+/.test(b.playlist);
      if (!aIsIP && bIsIP) return -1;
      if (aIsIP && !bIsIP) return 1;

      return 0;
    });

    return { stream: streams };
  },
});

// Beta embed
export const vidnestBetaEmbed = makeEmbed({
  id: 'vidnest-beta',
  name: 'Vidnest Beta',
  rank: 107,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url);
    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData?.url) throw new NotFoundError('Beta: missing url');

    const stream = await createFlixHQStream(decryptedData, 'beta', ctx);
    return { stream: [stream] };
  },
});

// Gama embed
export const vidnestGamaEmbed = makeEmbed({
  id: 'vidnest-gama',
  name: 'Vidnest Gama',
  rank: 109,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url);
    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData?.url) throw new NotFoundError('Gama: missing url');

    const stream = await createFlixHQStream(decryptedData, 'gama', ctx);
    return { stream: [stream] };
  },
});

// Sigma embed (uses hollymoviehd backend)
export const vidnestSigmaEmbed = makeEmbed({
  id: 'vidnest-sigma',
  name: 'Vidnest Sigma',
  rank: 108,
  flags: [],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData.success || !Array.isArray(decryptedData.sources) || !decryptedData.sources.length) {
      throw new NotFoundError('Sigma: no valid sources');
    }

    const hlsSources = decryptedData.sources.filter((s: any) => s.type === 'hls' && s.file);
    if (!hlsSources.length) throw new NotFoundError('Sigma: no HLS sources');

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

    return {
      stream: [
        {
          id: `sigma-${hlsSources[0].label || 'auto'}`,
          type: 'hls',
          playlist: createM3U8ProxyUrl(hlsSources[0].file, ctx.features, streamHeaders),
          flags: [],
          captions: [],
          headers: streamHeaders,
        } as HlsBasedStream,
      ],
    };
  },
});

// Catflix embed
export const vidnestCatflixEmbed = makeEmbed({
  id: 'vidnest-catflix',
  name: 'Vidnest Catflix',
  rank: 110,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });
    // console.log('Catflix Response:', response);

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData?.url) throw new NotFoundError('Catflix: missing url');

    const subtitles = Array.isArray(decryptedData.subtitles)
      ? decryptedData.subtitles.map((s: any) => ({
          url: s.url,
          lang: s.lang || s.label || 'Unknown',
          label: s.label || s.lang || 'Unknown',
          default: !!s.default,
        }))
      : [];

    return {
      stream: [
        {
          id: 'catflix-auto',
          type: 'hls',
          playlist: decryptedData.url,
          flags: [],
          captions: subtitles,
        } as HlsBasedStream,
      ],
    };
  },
});

// Hexa embed (uses superstream backend)
export const vidnestHexaEmbed = makeEmbed({
  id: 'vidnest-hexa',
  name: 'Vidnest Hexa',
  rank: 111,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });
    // console.log('Hexa Response:', response);

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    if (!decryptedData?.url) throw new NotFoundError('Hexa: missing url');

    return {
      stream: [
        {
          id: 'hexa-auto',
          type: 'hls',
          playlist: decryptedData.url,
          flags: [],
          captions: decryptedData.subtitles || [],
        } as HlsBasedStream,
      ],
    };
  },
});

// Delta embed - Hindi streams (uses rogflix backend)
export const vidnestDeltaEmbed = makeEmbed({
  id: 'vidnest-delta',
  name: 'Vidnest Delta (Hindi)',
  rank: 112,
  flags: [flags.CORS_ALLOWED],
  disabled: false,
  async scrape(ctx) {
    const response = await ctx.proxiedFetcher<any>(ctx.url, {
      headers: vidnestHeaders,
    });

    if (!response.data) throw new NotFoundError('No encrypted data found');

    const decryptedData = await decryptVidnestData(response.data);
    const streams = Array.isArray(decryptedData.streams) ? decryptedData.streams : [];
    if (!streams.length) throw new NotFoundError('Delta: no streams');

    const hindiStream = streams.find((s: any) => (s?.language || '').toLowerCase() === 'hindi');
    if (!hindiStream?.url) throw new NotFoundError('Delta: Hindi stream not available');

    return {
      stream: [
        {
          id: 'delta-hindi',
          type: 'hls',
          playlist: hindiStream.url,
          flags: [],
          captions: [],
        } as HlsBasedStream,
      ],
    };
  },
});
