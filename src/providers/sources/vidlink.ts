import { flags } from '@/entrypoint/utils/targets';
import { Caption } from '@/providers/captions';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

import { SourcererOutput, makeSourcerer } from '../base';

const ENC_DEC_API = 'https://enc-dec.app/api';

const VidlinkHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Connection: 'keep-alive',
  Referer: 'https://vidlink.pro/',
  Origin: 'https://vidlink.pro/',
};

async function comboScraper(ctx: MovieScrapeContext | ShowScrapeContext): Promise<SourcererOutput> {
  // Get encrypted TMDB ID
  const encryptResponse = await ctx.proxiedFetcher<{ result: string }>(`${ENC_DEC_API}/enc-vidlink`, {
    query: { text: ctx.media.tmdbId.toString() },
  });

  if (!encryptResponse?.result) throw new NotFoundError('Failed to encrypt TMDB ID');

  const encrypted = encryptResponse.result;

  // console.log('Encrypted ID:', encrypted);

  // Build vidlink API URL
  const apiUrl =
    ctx.media.type === 'movie'
      ? `https://vidlink.pro/api/b/movie/${encrypted}`
      : `https://vidlink.pro/api/b/tv/${encrypted}/${ctx.media.season.number}/${ctx.media.episode.number}`;

  // console.log('API URL:', apiUrl);

  // Fetch from vidlink API with proper headers
  let apiResponse = await ctx.proxiedFetcher<any>(apiUrl, {
    headers: VidlinkHeaders,
  });

  // Parse JSON string if needed
  if (typeof apiResponse === 'string') {
    apiResponse = JSON.parse(apiResponse);
  }

  // console.log('Full API Response:', JSON.stringify(apiResponse, null, 2));

  // The response already contains a complete stream object
  if (!apiResponse?.stream?.playlist) {
    // console.log('Available keys in response:', Object.keys(apiResponse || {}));
    throw new NotFoundError('No stream found in response');
  }

  // The captions are already in the correct format
  const captions: Caption[] = apiResponse.stream.captions || [];

  return {
    embeds: [],
    stream: [
      {
        id: apiResponse.stream.id || 'primary',
        playlist: createM3U8ProxyUrl(apiResponse.stream.playlist, ctx.features, VidlinkHeaders),
        type: apiResponse.stream.type || 'hls',
        flags: [flags.CORS_ALLOWED],
        captions,
      },
    ],
  };
}

export const vidlinkScraper = makeSourcerer({
  id: 'vidlink',
  name: 'Vidlink',
  rank: 199,
  disabled: true,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
