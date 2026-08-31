import { getChatGPTUser } from '@/app/chatgpt-auth';
import { readUserState, writeUserState } from '@/db/state';

const MAX_PAYLOAD_BYTES = 900_000;

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });
  const state = await readUserState(user.userId);
  return Response.json({
    authenticated: true,
    user: { displayName: user.displayName, email: user.email },
    state: state ? JSON.parse(state.payload) : null,
    revision: state?.revision || 0,
    updatedAt: state?.updatedAt || 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录后再使用云端同步。' }, { status: 401 });
  const body = await request.json().catch(() => null) as { state?: unknown } | null;
  if (!body || !body.state || typeof body.state !== 'object') {
    return Response.json({ error: '同步内容格式无效。' }, { status: 400 });
  }
  const payload = JSON.stringify(body.state);
  if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: '云端记录过多，请先清理部分历史对话。' }, { status: 413 });
  }
  const state = await writeUserState(user.userId,user.email,payload);
  return Response.json({ ok: true, revision: state?.revision || 1, updatedAt: state?.updatedAt || Date.now() });
}
