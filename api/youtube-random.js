const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.Youtube_api_key;
const MAX_VIDEOS = 500;

const COLLECTIONS = [
  { key: 'healing', title: '위로 힐링ㅣCCM', playlistId: 'PLyRpwp7Gg7cLYAYd3k0bpin7vKBRZtM9F' },
  { key: 'relax', title: 'Relax Musicㅣ힐링음악', playlistId: 'PLyRpwp7Gg7cLbDGm7lyiOvC85GNun25fX' },
  { key: 'shorts', title: '일상모음ㅣShorts', playlistId: 'PLyRpwp7Gg7cIfFsJhDrRYBMIyO1D7wt_B' }
];

const WORSHIP_CHANNELS = [
  { key: 'anointing', name: '어노인팅', handle: 'anointingworship', channelUrl: 'https://www.youtube.com/@anointingworship' },
  { key: 'markers', name: '마커스워십', handle: 'MarkersWorship', channelUrl: 'https://www.youtube.com/@MarkersWorship' },
  { key: 'fia', name: '피아워십', handle: 'FIAWORSHIP', channelUrl: 'https://www.youtube.com/@FIAWORSHIP' },
  { key: 'bible', name: '매일 성경 말씀듣기', handle: 'welcomebible', channelUrl: 'https://www.youtube.com/@welcomebible' }
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

function durationSeconds(value = '') {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
}

async function fetchLatestWorship(channel) {
  try {
    const channelData = await youtube('channels', { part: 'contentDetails', forHandle: channel.handle, maxResults: '1' });
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) throw new Error('Uploads playlist not found');
    const uploads = await youtube('playlistItems', { part: 'contentDetails', playlistId: uploadsId, maxResults: '12' });
    const ids = (uploads.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    if (!ids.length) throw new Error('No uploads found');
    const details = await youtube('videos', { part: 'snippet,contentDetails,status', id: ids.join(','), maxResults: '50' });
    const videos = (details.items || []).map(item => {
      const seconds = durationSeconds(item.contentDetails?.duration);
      return {
        id: item.id,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
        publishedAt: item.snippet?.publishedAt,
        duration: formatDuration(seconds),
        seconds
      };
    }).filter(video => video.id && video.title);
    const latest = videos.find(video => video.seconds >= 180) || videos[0];
    return { ...channel, latest };
  } catch (error) {
    return { ...channel, latest: null };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' });
  if (!YOUTUBE_API_KEY) return response.status(503).json({ message: 'YouTube recommendations are not configured yet.' });
  try {
    const [collections, worship] = await Promise.all([
      Promise.all(COLLECTIONS.map(fetchPlaylist)),
      Promise.all(WORSHIP_CHANNELS.map(fetchLatestWorship))
    ]);
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    return response.status(200).json({ collections, worship, videos: collections[0]?.videos || [] });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load KONGDARY TV playlists.' });
  }
}
