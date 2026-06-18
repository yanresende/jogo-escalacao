/* ============================================================
   7a0 — Camada de persistência (PostgreSQL na Railway)
   Usa DATABASE_URL quando disponível; cai num store em memória
   (com aviso) quando não há banco, para o dev local não quebrar.
   ============================================================ */

let Pool = null;
try { Pool = require('pg').Pool; } catch (_) { Pool = null; } // pg pode não estar instalado ainda

const HAS_DB = !!process.env.DATABASE_URL && !!Pool;

let pool = null;
const mem = { profiles: new Map(), daily: new Map() }; // fallback em memória

// ── Init / migração ───────────────────────────────────────────
async function init() {
  if (!HAS_DB) {
    console.warn('[db] DATABASE_URL ausente ou "pg" não instalado — usando store EM MEMÓRIA (não persiste). ' +
      'Na Railway, adicione o plugin PostgreSQL para persistir.');
    return;
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      uid          TEXT PRIMARY KEY,
      name         TEXT,
      coins        INTEGER DEFAULT 0,
      career       JSONB DEFAULT '{}'::jsonb,
      achievements JSONB DEFAULT '[]'::jsonb,
      collectibles JSONB DEFAULT '[]'::jsonb,
      updated_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS daily_scores (
      id         SERIAL PRIMARY KEY,
      date       DATE NOT NULL,
      uid        TEXT NOT NULL,
      name       TEXT,
      score      INTEGER NOT NULL,
      detail     JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (date, uid)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_date_score ON daily_scores (date, score DESC);
  `);
  console.log('[db] PostgreSQL conectado e migração aplicada.');
}

// ── Perfil ────────────────────────────────────────────────────
async function getProfile(uid) {
  if (!HAS_DB) return mem.profiles.get(uid) || null;
  const r = await pool.query('SELECT uid, name, coins, career, achievements, collectibles FROM profiles WHERE uid = $1', [uid]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  // "achatamos" career (JSONB) com os campos de topo p/ o client
  return Object.assign(
    { name: row.name, coins: row.coins, achievements: row.achievements || [], collectibles: row.collectibles || [] },
    row.career || {}
  );
}

async function saveProfile(uid, profile) {
  profile = profile || {};
  const name = profile.name || 'Você';
  const coins = Number.isFinite(profile.coins) ? profile.coins : 0;
  const achievements = profile.achievements || [];
  const collectibles = profile.collectibles || [];
  // tudo que não são campos de topo vai para "career"
  const { name: _n, coins: _c, achievements: _a, collectibles: _co, ...career } = profile;

  if (!HAS_DB) { mem.profiles.set(uid, profile); return profile; }
  await pool.query(`
    INSERT INTO profiles (uid, name, coins, career, achievements, collectibles, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6, now())
    ON CONFLICT (uid) DO UPDATE SET
      name = EXCLUDED.name, coins = EXCLUDED.coins, career = EXCLUDED.career,
      achievements = EXCLUDED.achievements, collectibles = EXCLUDED.collectibles, updated_at = now()
  `, [uid, name, coins, career, JSON.stringify(achievements), JSON.stringify(collectibles)]);
  return profile;
}

// ── Ranking diário ────────────────────────────────────────────
async function submitDaily({ date, uid, name, score, detail }) {
  score = parseInt(score, 10) || 0;
  if (!HAS_DB) {
    if (!mem.daily.has(date)) mem.daily.set(date, new Map());
    const day = mem.daily.get(date);
    const prev = day.get(uid);
    if (!prev || score > prev.score) day.set(uid, { uid, name, score, detail });
    return { ok: true };
  }
  await pool.query(`
    INSERT INTO daily_scores (date, uid, name, score, detail)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (date, uid) DO UPDATE SET
      score = GREATEST(daily_scores.score, EXCLUDED.score),
      name = EXCLUDED.name,
      detail = EXCLUDED.detail
  `, [date, uid, name || 'Anônimo', score, detail || {}]);
  return { ok: true };
}

async function getLeaderboard(date, limit = 50) {
  if (!HAS_DB) {
    const day = mem.daily.get(date);
    const rows = day ? [...day.values()] : [];
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, limit);
  }
  const r = await pool.query(
    'SELECT uid, name, score FROM daily_scores WHERE date = $1 ORDER BY score DESC LIMIT $2',
    [date, limit]
  );
  return r.rows;
}

module.exports = { init, getProfile, saveProfile, submitDaily, getLeaderboard, HAS_DB };
