import { env } from 'cloudflare:workers';

export type StoredCloudState = {
  payload: string;
  revision: number;
  updatedAt: number;
};

async function ensureStateSchema() {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_state_updated_at ON user_state(updated_at)'),
  ]);
}

export async function readUserState(userId: string): Promise<StoredCloudState | null> {
  await ensureStateSchema();
  const row = await env.DB.prepare('SELECT payload, revision, updated_at AS updatedAt FROM user_state WHERE user_id = ?')
    .bind(userId)
    .first<StoredCloudState>();
  return row || null;
}

export async function writeUserState(userId: string, email: string, payload: string) {
  await ensureStateSchema();
  const updatedAt = Date.now();
  await env.DB.prepare(`INSERT INTO user_state (user_id,email,payload,revision,updated_at)
    VALUES (?,?,?,1,?)
    ON CONFLICT(user_id) DO UPDATE SET
      email=excluded.email,
      payload=excluded.payload,
      revision=user_state.revision+1,
      updated_at=excluded.updated_at`)
    .bind(userId,email,payload,updatedAt)
    .run();
  return readUserState(userId);
}
