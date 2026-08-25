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
    const random = recent.slice(1).sort(() => Math.random() - 0.5).slice(0, 3);
    const posts = recent.length ? [recent[0], ...random] : [];
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    return response.status(200).json({ posts, selection: 'latest-and-random' });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to load Threads posts.' });
  }
}
