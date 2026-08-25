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
  { key: 'bible', name: '두란노 생명의 삶', handle: 'cgn8459', channelId: 'UCbaI7e7lhkfLSdMUfd5Fy0Q', qtPlaylistId: 'PLrH3J2Hst9zSfUE5jmSkGmOfHQ6V_k0aK', channelUrl: 'https://www.youtube.com/@cgn8459', contentType: 'daily-qt' }
];

const FALLBACK_DAILY_QT = {
  id: 'vPc56AWgWzo',
  title: '[생명의 삶 큐티] 하나님께 더 가까이 나아가는 예배 | 에스겔 46:1~15 | 임채영 목사 | 260825QT',
  thumbnail: 'https://i.ytimg.com/vi/vPc56AWgWzo/hqdefault.jpg',
  publishedAt: '2026-08-25T00:00:00Z',
  duration: '14:24',
  seconds: 864,
  source: 'last-known-good'
};

const FALLBACK_PREVIOUS_QT = {
  id: '842x2W3FCoU',
  title: '[생명의 삶 큐티] 하나님을 중심에 두는 새 언약 백성 | 에스겔 45:1~8 | 임채영 목사 | 260823QT',
  thumbnail: 'https://i.ytimg.com/vi/842x2W3FCoU/hqdefault.jpg',
  publishedAt: '2026-08-23T00:00:00Z',
  duration: '12:36',
  seconds: 756,
  source: 'last-known-good'
};

function isDailyQtTitle(title = '') {
  const normalized = title.toLowerCase();
  const hangulCount = (title.match(/[가-힣]/g) || []).length;
  const isKoreanQt = /(생명의\s*삶|오늘의\s*(qt|큐티|말씀)|한국어\s*(qt|큐티)|큐티)/i.test(normalized);
  const excluded = /(living\s*life|shorts?|쇼츠|라이브|live\s*stream|예고|티저)/i.test(normalized) || /[ぁ-ゟ゠-ヿ]/.test(title);
  return hangulCount >= 5 && isKoreanQt && !excluded;
}

async function fetchDailyQtPageFallback(channel) {
  const page = await fetch(`${channel.channelUrl}/videos`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KONGDARY/1.0)' }
  });
  if (!page.ok) throw new Error(`YouTube page fallback failed: ${page.status}`);
  const decoded = (await page.text()).replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  const candidates = [];
  const seen = new Set();
  const pattern = /"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,1800}?"title":\{"runs":\[\{"text":"([^"]+)"/g;
  for (const match of decoded.matchAll(pattern)) {
    const [, id, title] = match;
    if (seen.has(id) || !isDailyQtTitle(title)) continue;
    seen.add(id);
    candidates.push({
      id,
      title: title.replace(/\\u0026/g, '&'),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      duration: 'QT',
      seconds: 180,
      source: 'youtube-page-fallback'
    });
    if (candidates.length === 2) break;
  }
  if (!candidates.length) throw new Error('No Daily QT videos found on official channel page');
  return { ...channel, latest: candidates[0], alternate: candidates[1] || null };
}

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
    let ids = [];
    if (channel.contentType === 'daily-qt' && channel.qtPlaylistId) {
      const qtPlaylist = await youtube('playlistItems', {
        part: 'contentDetails', playlistId: channel.qtPlaylistId, maxResults: '25'
      });
      ids = (qtPlaylist.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    } else {
      let uploadsId = channel.uploadsPlaylistId;
      if (!uploadsId) {
        const channelData = await youtube('channels', {
          part: 'contentDetails',
          ...(channel.channelId ? { id: channel.channelId } : { forHandle: channel.handle }),
          maxResults: '1'
        });
        uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      }
      if (!uploadsId) throw new Error('Uploads playlist not found');
      const uploads = await youtube('playlistItems', { part: 'contentDetails', playlistId: uploadsId, maxResults: '12' });
      ids = (uploads.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    }
    if (!ids.length) throw new Error('No uploads found');
    const details = await youtube('videos', { part: 'snippet,contentDetails,status', id: ids.join(','), maxResults: '50' });
    const videos = (details.items || []).map(item => {
      const seconds = durationSeconds(item.contentDetails?.duration);
      return {
        id: item.id,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
        publishedAt: item.snippet?.publishedAt,
        liveBroadcastContent: item.snippet?.liveBroadcastContent,
        embeddable: item.status?.embeddable,
        privacyStatus: item.status?.privacyStatus,
        duration: formatDuration(seconds),
        seconds,
        source: 'youtube-api'
      };
    }).filter(video => video.id && video.title);
    const eligible = videos.filter(video => {
      if (video.seconds < 180 || video.liveBroadcastContent === 'live' || video.liveBroadcastContent === 'upcoming') return false;
      if (video.embeddable === false || (video.privacyStatus && video.privacyStatus !== 'public')) return false;
      if (channel.contentType !== 'daily-qt') return true;
      return isDailyQtTitle(video.title);
    });
    const latest = eligible[0] || (channel.contentType === 'daily-qt' ? FALLBACK_DAILY_QT : videos.find(video => video.seconds >= 180) || videos[0]);
    const alternate = channel.contentType === 'daily-qt' ? eligible.find(video => video.id !== latest?.id) || null : null;
    return { ...channel, latest, alternate };
  } catch (error) {
    if (channel.contentType === 'daily-qt') {
      try {
        return await fetchDailyQtPageFallback(channel);
      } catch (fallbackError) {
        return { ...channel, latest: FALLBACK_DAILY_QT, alternate: null };
      }
    }
    return { ...channel, latest: null, alternate: null };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' });
  if (!YOUTUBE_API_KEY) return response.status(503).json({ message: 'YouTube recommendations are not configured yet.' });
  try {
    const [collections, channelResults] = await Promise.all([
      Promise.all(COLLECTIONS.map(fetchPlaylist)),
      Promise.all(WORSHIP_CHANNELS.map(fetchLatestWorship))
    ]);
    const bible = channelResults.find(channel => channel.key === 'bible');
    const dailyWord = bible ? { ...bible, latest: bible.latest || FALLBACK_DAILY_QT } : null;
    const worship = channelResults.map(({ alternate, ...channel }) => channel.key === 'bible' ? { ...channel, latest: alternate || FALLBACK_PREVIOUS_QT } : channel);
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    return response.status(200).json({ collections, worship, dailyWord, videos: collections[0]?.videos || [] });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load KONGDARY TV playlists.' });
  }
}
