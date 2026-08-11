const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

function readText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: '허용되지 않은 요청입니다.' });
  if (REQUIRED_ENV.some((key) => !process.env[key])) return response.status(503).json({ message: '문의 접수 설정을 준비 중입니다. 잠시 후 다시 시도해 주세요.' });

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
  const name = readText(body.name, 80);
  const email = readText(body.email, 254).toLowerCase();
  const topic = readText(body.topic, 40) || '이야기';
  const message = readText(body.message, 4000);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || !emailPattern.test(email) || !message || body.consent !== 'on') return response.status(400).json({ message: '필수 항목과 개인정보 동의를 확인해 주세요.' });

  const insert = await fetch(`${process.env.SUPABASE_URL}/rest/v1/contact_requests`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ name, email, topic, message, consented_at: new Date().toISOString() })
  });
  if (!insert.ok) return response.status(500).json({ message: '이야기를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  return response.status(201).json({ message: '이야기가 전달되었습니다.' });
}
