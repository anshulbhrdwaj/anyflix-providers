/* eslint-disable no-template-curly-in-string */
import { flags } from '@/entrypoint/utils/targets';
import { makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

const backendUrl = 'https://backend.vidnest.fun';

// Server configurations matching the actual implementation
const servers = [
  {
    server: 'lamda',
    tvUrl: 'rogflix/tv',
    movieUrl: 'rogflix/movie',
  },
  {
    server: 'alfa',
    tvUrl: 'primesrc/tv',
    movieUrl: 'primesrc/movie',
  },
  {
    server: 'beta',
    tvUrl: 'flixhq/tv',
    movieUrl: 'flixhq/movie',
    params: { server: 'upcloud' },
  },
  {
    server: 'sigma',
    tvUrl: 'hollymoviehd/tv',
    movieUrl: 'hollymoviehd/movie',
  },
  {
    server: 'gama',
    tvUrl: 'flixhq/tv',
    movieUrl: 'flixhq/movie',
    params: { server: 'megacloud' },
  },
  {
    server: 'catflix',
    tvUrl: 'catflix/tv',
    movieUrl: 'catflix/movie',
  },
  {
    server: 'hexa',
    tvUrl: 'superstream/tv',
    movieUrl: 'superstream/movie',
  },
  {
    server: 'delta',
    tvUrl: 'rogflix/tv',
    movieUrl: 'rogflix/movie',
  },
];

async function scrape(ctx: MovieScrapeContext | ShowScrapeContext) {
  const embeds = [];

  for (const server of servers) {
    let url = '';

    // Handle Movie URLs
    if (ctx.media.type === 'movie') {
      url = `${backendUrl}/${server.movieUrl}/${ctx.media.tmdbId}`;
    }
    // Handle TV Show URLs
    else if (ctx.media.type === 'show') {
      url = `${backendUrl}/${server.tvUrl}/${ctx.media.tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
    }

    // Append query parameters if they exist
    if (server.params && Object.keys(server.params).length > 0) {
      const parsedUrl = new URL(url);
      for (const [key, value] of Object.entries(server.params)) {
        parsedUrl.searchParams.set(key, value);
      }
      url = parsedUrl.toString();
    }

    embeds.push({
      embedId: `vidnest-${server.server}`,
      url,
    });
  }

  return {
    embeds,
  };
}

const vidnestScraper = makeSourcerer({
  id: 'vidnest',
  name: 'Vidnest',
  rank: 196,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: (ctx: MovieScrapeContext) => scrape(ctx),
  scrapeShow: (ctx: ShowScrapeContext) => scrape(ctx),
});

export default vidnestScraper;
