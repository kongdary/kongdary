const SUPABASE_URL = 'https://xulwhgzqyxxhdgqsmoux.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bHdoZ3pxeXh4aGRncXNtb3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTIyMTcsImV4cCI6MjEwMjAyODIxN30.y_up4RdCJmCZkD7JXVxypBx93pDfuRBzKPdZrmZqem4';

function readText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 요청입니다.' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
    const name = readText(body.name, 80);
    const email = readText(body.email, 254).toLowerCase();
    const topic = readText(body.topic, 40) || '이야기';
    const message = readText(body.message, 4000);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !message || body.consent !== 'on') {
      return response.status(400).json({ message: '이름, 이야기 내용, 개인정보 동의를 확인해 주세요.' });
    }
    if (email && !emailPattern.test(email)) {
      return response.status(400).json({ message: '이메일 형식을 확인하거나 비워 주세요.' });
    }

    const insert = await fetch(`${SUPABASE_URL}/rest/v1/contact_requests`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ name, email: email || 'no-email@kongdary.local', topic, message, consented_at: new Date().toISOString() })
    });

    if (!insert.ok) {
      const detail = await insert.text();
      console.error('Contact insert failed:', insert.status, detail);
      return response.status(500).json({ message: '이야기를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    return response.status(201).json({ message: '이야기 보내기가 완료되었습니다.' });
  } catch (error) {
    console.error('Contact handler failed:', error);
    return response.status(500).json({ message: '전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
