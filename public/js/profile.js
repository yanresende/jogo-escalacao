/* ============================================================
   7a0 — Perfil do jogador (client)
   Identidade anônima (uid no localStorage). Sincroniza com o
   backend PostgreSQL quando disponível; cai no localStorage se não.
   ============================================================ */
const Profile = (function () {
  const KEY = '7a0_profile';
  const UIDKEY = '7a0_uid';

  function uid() {
    let u = localStorage.getItem(UIDKEY);
    if (!u) {
      u = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(UIDKEY, u);
    }
    return u;
  }

  function defaults() {
    return { name: 'Você', coins: 0, careerRound: 1, careerWins: 0, bonusWildcards: 0, achievements: [], collectibles: [] };
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }

  let cache = null;

  function get() {
    if (!cache) cache = Object.assign(defaults(), readLocal());
    return cache;
  }

  function persistLocal() {
    localStorage.setItem(KEY, JSON.stringify(get()));
  }

  async function load() {
    cache = Object.assign(defaults(), readLocal());
    try {
      const r = await fetch('/api/profile/' + uid());
      if (r.ok) {
        const data = await r.json();
        if (data && data.profile) { cache = Object.assign(defaults(), cache, data.profile); persistLocal(); }
      }
    } catch (e) { /* offline → usa localStorage */ }
    return cache;
  }

  async function save(patch) {
    cache = Object.assign(get(), patch || {});
    persistLocal();
    try {
      await fetch('/api/profile/' + uid(), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cache }),
      });
    } catch (e) { /* offline */ }
    return cache;
  }

  // Conquistas: adiciona ids novos, retorna os recém-desbloqueados.
  async function unlockAchievements(ids) {
    const cur = new Set(get().achievements || []);
    const fresh = ids.filter(id => !cur.has(id));
    if (fresh.length) { fresh.forEach(id => cur.add(id)); await save({ achievements: [...cur] }); }
    return fresh;
  }

  async function addCollectible(id) {
    const cur = new Set(get().collectibles || []);
    if (!cur.has(id)) { cur.add(id); await save({ collectibles: [...cur] }); return true; }
    return false;
  }

  async function submitDaily(date, score, detail) {
    try {
      const r = await fetch('/api/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid(), name: get().name, date, score, detail: detail || {} }),
      });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }

  async function leaderboard(date) {
    try {
      const r = await fetch('/api/daily/' + date);
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }

  return { uid, get, load, save, unlockAchievements, addCollectible, submitDaily, leaderboard };
})();

// Carrega o perfil ao iniciar (não bloqueia a UI).
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => { Profile.load(); });
}
