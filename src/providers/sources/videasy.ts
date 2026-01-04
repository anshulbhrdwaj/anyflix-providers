import { flags } from '@/entrypoint/utils/targets';
import { makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

const BASE_URL = 'https://api.videasy.net';

// Configuration for all Videasy servers based on your list
const servers = [
  { id: 'neon', path: 'myflixerzupcloud/sources-with-title', name: 'Neon', lang: 'Original' },
  { id: 'sage', path: '1movies/sources-with-title', name: 'Sage', lang: 'Original' },
  { id: 'cypher', path: 'moviebox/sources-with-title', name: 'Cypher', lang: 'Original' },
  { id: 'yoru', path: 'cdn/sources-with-title', name: 'Yoru', lang: 'Original', movieOnly: true },
  { id: 'reyna', path: 'primewire/sources-with-title', name: 'Reyna', lang: 'Original' },
  { id: 'omen', path: 'onionplay/sources-with-titlequote', name: 'Omen', lang: 'Original' },
  { id: 'breach', path: 'm4uhd/sources-with-title', name: 'Breach', lang: 'Original' },
  { id: 'vyse', path: 'hdmovie/sources-with-title', name: 'Vyse', lang: 'Original' },
  { id: 'killjoy', path: 'meine/sources-with-title', name: 'Killjoy', lang: 'German', params: { language: 'german' } },
  { id: 'harbor', path: 'meine/sources-with-title', name: 'Harbor', lang: 'Italian', params: { language: 'italian' } },
  {
    id: 'chamber',
    path: 'meine/sources-with-title',
    name: 'Chamber',
    lang: 'French',
    movieOnly: true,
    params: { language: 'french' },
  },
  { id: 'fade', path: 'hdmovie/sources-with-title', name: 'Fade', lang: 'Hindi' }, // Note: URL same as Vyse, assuming different internal routing or user preference
  { id: 'gekko', path: 'cuevana-latino/sources-with-title', name: 'Gekko', lang: 'Latin' },
  { id: 'kayo', path: 'cuevana-spanish/sources-with-title', name: 'Kayo', lang: 'Spanish' },
  { id: 'raze', path: 'superflix/sources-with-title', name: 'Raze', lang: 'Portuguese' },
  { id: 'phoenix', path: 'overflix/sources-with-title', name: 'Phoenix', lang: 'Portuguese' },
  { id: 'astra', path: 'visioncine/sources-with-title', name: 'Astra', lang: 'Portuguese' },
];

async function scrape(ctx: MovieScrapeContext | ShowScrapeContext) {
  const embeds = [];

  for (const server of servers) {
    // Skip if server is movie-only and we are scraping a show
    if (server.movieOnly && ctx.media.type === 'show') continue;

    // Construct the URL object
    const url = new URL(`${BASE_URL}/${server.path}`);

    // Add common query parameters
    url.searchParams.set('title', ctx.media.title);
    url.searchParams.set('year', ctx.media.releaseYear.toString());
    url.searchParams.set('tmdbId', ctx.media.tmdbId);

    // Handle Media Type specifics
    if (ctx.media.type === 'movie') {
      url.searchParams.set('mediaType', 'movie');
    } else if (ctx.media.type === 'show') {
      url.searchParams.set('mediaType', 'tv');
      url.searchParams.set('seasonId', ctx.media.season.number.toString());
      url.searchParams.set('episodeId', ctx.media.episode.number.toString());
    }

    // Add server-specific params (e.g., language flags)
    if (server.params) {
      for (const [key, value] of Object.entries(server.params)) {
        url.searchParams.set(key, value);
      }
    }

    embeds.push({
      embedId: `videasy-${server.id}`,
      url: url.toString(),
    });
  }

  return {
    embeds,
  };
}

export const videasyScraper = makeSourcerer({
  id: 'videasy',
  name: 'Videasy',
  rank: 195, // Adjusted rank slightly
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: (ctx: MovieScrapeContext) => scrape(ctx),
  scrapeShow: (ctx: ShowScrapeContext) => scrape(ctx),
});
