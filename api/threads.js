const THREADS_API = 'https://graph.threads.net/v1.0';
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' });
  if (!THREADS_ACCESS_TOKEN) return response.status(503).json({ message: 'Threads is not configured yet.' });
  try {
    const url = new URL(`${THREADS_API}/me/threads`);
    url.searchParams.set('fields', 'id,text,timestamp,permalink,media_type,media_url,thumbnail_url');
    url.searchParams.set('limit', '12');
    url.searchParams.set('access_token', THREADS_ACCESS_TOKEN);
    const result = await fetch(url);
    if (!result.ok) throw new Error(`Threads API request failed: ${result.status}`);
    const payload = await result.json();
    const recent = (payload.data || []).filter(post => post.text).map(post => ({
      id: post.id, text: post.text, timestamp: post.timestamp, permalink: post.permalink,
      image: post.thumbnail_url || (post.media_type === 'IMAGE' ? post.media_url : null)
    }));
    const selectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const seed = [...selectedDate].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
    const scored = recent.slice(1).map((post, index) => ({ post, score: hash(`${seed}:${post.id}:${index}`) }));
    scored.sort((a, b) => a.score - b.score);
    const posts = recent.length ? [recent[0], ...scored.slice(0, 5).map(item => item.post)] : [];
    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
    return response.status(200).json({ posts, selection: 'latest-and-daily-random', selectedDate });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load Threads posts.' });
  }
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
