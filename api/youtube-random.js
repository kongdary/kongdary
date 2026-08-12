const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_HANDLE = '@kongdarytv';
const MAX_VIDEOS = 500;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.Youtube_api_key;

function apiUrl(path, params) {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function youtube(path, params) {
  const response = await fetch(apiUrl(path, { ...params, key: YOUTUBE_API_KEY }));
  if (!response.ok) throw new Error(`YouTube API request failed: ${response.status}`);
  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' });
  if (!YOUTUBE_API_KEY) return response.status(503).json({ message: 'YouTube recommendations are not configured yet.' });

  try {
    const channel = await youtube('channels', { part: 'contentDetails', forHandle: CHANNEL_HANDLE });
    const uploadsPlaylist = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylist) return response.status(404).json({ message: 'KONGDARY TV channel was not found.' });

    const videos = [];
    let pageToken = '';
    do {
      const page = await youtube('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadsPlaylist, maxResults: '50', pageToken });
      page.items.forEach((item) => {
        const videoId = item.contentDetails?.videoId;
        const snippet = item.snippet;
        if (!videoId || !snippet?.title || snippet.title === 'Private video' || snippet.title === 'Deleted video') return;
        videos.push({
          id: videoId,
          title: snippet.title,
          thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
          publishedAt: snippet.publishedAt
        });
      });
      pageToken = page.nextPageToken || '';
    } while (pageToken && videos.length < MAX_VIDEOS);

    response.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return response.status(200).json({ videos });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load KONGDARY TV videos.' });
  }
}
