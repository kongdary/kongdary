export default async function handler(request, response) {
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ message: 'Unauthorized' });
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/contact_requests?created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: 'DELETE',
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=minimal' }
  });
  return result.ok ? response.status(200).json({ message: 'Expired inquiries removed.' }) : response.status(500).json({ message: 'Cleanup failed.' });
}
