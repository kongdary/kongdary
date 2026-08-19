const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.Youtube_api_key;
const MAX_VIDEOS = 500;

const COLLECTIONS = [
  { key: 'healing', title: '위로 힐링ㅣCCM', playlistId: 'PLyRpwp7Gg7cLYAYd3k0bpin7vKBRZtM9F' },
  { key: 'relax', title: 'Relax Musicㅣ힐링음악', playlistId: 'PLyRpwp7Gg7cLbDGm7lyiOvC85GNun25fX' },
  { key: 'shorts', title: '일상모음ㅣShorts', playlistId: 'PLyRpwp7Gg7cIfFsJhDrRYBMIyO1D7wt_B' }
];

function apiUrl(path, params) {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  return url;
}

async function youtube(path, params) {
  const response = await fetch(apiUrl(path, { ...params, key: YOUTUBE_API_KEY }));
  if (!response.ok) throw new Error(`YouTube API request failed: ${response.status}`);
  return response.json();
}

async function fetchPlaylist(collection) {
  const videos = [];
  let pageToken = '';
  do {
    const page = await youtube('playlistItems', {
      part: 'snippet,contentDetails', playlistId: collection.playlistId,
      maxResults: '50', pageToken
    });
    for (const item of page.items || []) {
      const videoId = item.contentDetails?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title || snippet.title === 'Private video' || snippet.title === 'Deleted video') continue;
      videos.push({
        id: videoId,
        title: snippet.title,
        thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
        publishedAt: snippet.publishedAt
      });
    }
    pageToken = page.nextPageToken || '';
  } while (pageToken && videos.length < MAX_VIDEOS);
  return { ...collection, videos };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' });
  if (!YOUTUBE_API_KEY) return response.status(503).json({ message: 'YouTube recommendations are not configured yet.' });
  try {
    const collections = await Promise.all(COLLECTIONS.map(fetchPlaylist));
    response.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return response.status(200).json({ collections, videos: collections[0]?.videos || [] });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load KONGDARY TV playlists.' });
  }
}
