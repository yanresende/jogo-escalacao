/* ============================================================
   7a0 — Modos de Jogo (Diário, Carreira, Restrição/Survival)
   Depende de: game.js (state, FORMATIONS, initDraft), engine.js
   (mulberry32, hashStringToSeed, evaluateAchievements, ACHIEVEMENTS),
   ui.js (renderDraftScreen, showToast), profile.js (Profile).
   ============================================================ */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Pontuação de torneio ──────────────────────────────────────
function tournamentScore(r) {
  let goalDiff = 0;
  for (const s of r.results) {
    if (s.status !== 'skipped' && s.goalsFor != null) goalDiff += (s.goalsFor - s.goalsAgainst);
  }
  return r.stagesReached * 1000 + (r.champion ? 5000 : 0) +
    (r.stats.overall || 0) * 10 + (r.chemistry || 0) * 5 + goalDiff * 20;
}

// ════════════════════════════════════════════════════════════
//  DESAFIO DIÁRIO
// ════════════════════════════════════════════════════════════
const DAILY_THEMES = [
  { formation: '4-3-3',   label: 'Clássico 4-3-3' },
  { formation: '4-4-2',   label: 'Dupla de ataque (4-4-2)' },
  { formation: '3-5-2',   label: 'Alas ofensivos (3-5-2)' },
  { formation: '4-2-3-1', label: 'Meio sólido (4-2-3-1)' },
  { formation: '3-4-3',   label: 'Ataque total (3-4-3)' },
];

function dailyTheme(seed) {
  return DAILY_THEMES[seed % DAILY_THEMES.length];
}

async function startDaily() {
  state.isMultiplayer = false;
  state.gameMode = 'daily';
  state.restrictions = null;
  goTo('daily');
  renderDailyScreen();
}

async function renderDailyScreen() {
  const date = todayStr();
  const seed = hashStringToSeed(date);
  const theme = dailyTheme(seed);
  const el = document.getElementById('daily-content');
  const done = (Profile.get().lastDaily === date);

  el.innerHTML = `
    <div class="daily-card">
      <div class="daily-date">${date}</div>
      <h3>Desafio de Hoje</h3>
      <p class="daily-theme">Formação: <strong>${theme.label}</strong></p>
      <p class="daily-rule">Todos recebem a <strong>mesma sequência de seleções</strong>. Monte o melhor time e suba no ranking!</p>
      ${done ? `<p class="daily-done">✓ Você já jogou hoje — pode tentar de novo, mas o ranking guarda seu melhor resultado.</p>` : ''}
      <button class="btn btn-primary btn-large" id="btn-begin-daily">▶ Começar Desafio</button>
    </div>
    <div class="daily-board">
      <h4>🏅 Ranking de Hoje</h4>
      <div id="daily-leaderboard" class="leaderboard">Carregando…</div>
    </div>`;

  document.getElementById('btn-begin-daily').addEventListener('click', () => beginDailyDraft(theme, seed));
  loadDailyLeaderboard(date);
}

async function loadDailyLeaderboard(date) {
  const board = document.getElementById('daily-leaderboard');
  if (!board) return;
  const data = await Profile.leaderboard(date);
  const rows = (data && data.scores) || [];
  if (!rows.length) { board.innerHTML = '<p class="lb-empty">Ainda sem pontuações. Seja o primeiro!</p>'; return; }
  board.innerHTML = rows.slice(0, 10).map((s, i) =>
    `<div class="lb-row${s.uid === Profile.uid() ? ' me' : ''}">
       <span class="lb-pos">${i + 1}</span>
       <span class="lb-name">${(s.name || 'Anônimo').slice(0, 16)}</span>
       <span class="lb-score">${s.score}</span>
     </div>`).join('');
}

function beginDailyDraft(theme, seed) {
  state.gameMode = 'daily';
  state.mode = 'classic';
  initDraft(theme.formation);
  // Sequência determinística de seleções (mesma p/ todos no mesmo dia)
  const rng = mulberry32(seed);
  state.dailySeq = Array.from({ length: 40 }, () => SQUAD_LIST[Math.floor(rng() * SQUAD_LIST.length)]);
  state.dailyPtr = 0;
  renderDraftScreen();
  goTo('draft');
}

// ════════════════════════════════════════════════════════════
//  CARREIRA
// ════════════════════════════════════════════════════════════
function startCareer() {
  state.isMultiplayer = false;
  state.gameMode = 'career';
  state.restrictions = null;
  renderCareerScreen();
  goTo('career');
}

const CAREER_SHOP = [
  { id: 'wildcard', label: '+1 Re-roll inicial', emoji: '⚡', cost: 150, apply: p => ({ bonusWildcards: (p.bonusWildcards || 0) + 1 }) },
];

function renderCareerScreen() {
  const p = Profile.get();
  document.getElementById('career-coins').textContent = p.coins || 0;
  const el = document.getElementById('career-content');
  el.innerHTML = `
    <div class="career-hero">
      <div class="career-stat"><span class="cs-label">Temporada — Rodada</span><span class="cs-val">${p.careerRound || 1}</span></div>
      <div class="career-stat"><span class="cs-label">Títulos</span><span class="cs-val">${p.careerWins || 0}</span></div>
      <div class="career-stat"><span class="cs-label">Re-rolls bônus</span><span class="cs-val">${p.bonusWildcards || 0}</span></div>
    </div>
    <p class="career-info">Cada rodada aumenta a dificuldade dos adversários. Ganhe moedas pelo desempenho e desbloqueie vantagens.</p>
    <button class="btn btn-primary btn-large" id="btn-play-career">▶ Jogar Rodada ${p.careerRound || 1}</button>
    <button class="btn btn-secondary" id="btn-open-achievements">🏅 Ver Conquistas (${(p.achievements || []).length}/${(typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.length : 0)})</button>
    <div class="career-shop">
      <h4>🛒 Loja</h4>
      <div class="shop-grid">
        ${CAREER_SHOP.map(item => `
          <button class="shop-item" data-shop="${item.id}" ${(p.coins || 0) < item.cost ? 'disabled' : ''}>
            <span class="shop-emoji">${item.emoji}</span>
            <span class="shop-label">${item.label}</span>
            <span class="shop-cost">🪙 ${item.cost}</span>
          </button>`).join('')}
      </div>
    </div>`;

  document.getElementById('btn-play-career').addEventListener('click', () => {
    state.gameMode = 'career';
    state.mode = 'classic';
    goTo('formation');
    renderFormationGrid();
  });
  const achvBtn = document.getElementById('btn-open-achievements');
  if (achvBtn) achvBtn.addEventListener('click', () => { renderAchievements(); goTo('achievements'); });
  el.querySelectorAll('.shop-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = CAREER_SHOP.find(i => i.id === btn.dataset.shop);
      const prof = Profile.get();
      if (!item || (prof.coins || 0) < item.cost) return;
      const patch = Object.assign({ coins: prof.coins - item.cost }, item.apply(prof));
      await Profile.save(patch);
      renderCareerScreen();
      showToast(`Comprado: ${item.label}`);
    });
  });
}

// ── Galeria de conquistas ─────────────────────────────────────
function renderAchievements() {
  const el = document.getElementById('achv-content');
  if (!el || typeof ACHIEVEMENTS === 'undefined') return;
  const unlocked = new Set(Profile.get().achievements || []);
  el.innerHTML = `
    <p class="achv-progress">${unlocked.size} de ${ACHIEVEMENTS.length} desbloqueadas</p>
    <div class="achv-grid">
      ${ACHIEVEMENTS.map(a => {
        const got = unlocked.has(a.id);
        return `
          <div class="achv-card${got ? ' got' : ' locked'}">
            <div class="achv-emoji">${got ? a.emoji : '🔒'}</div>
            <div class="achv-name">${a.label}</div>
            <div class="achv-desc">${a.desc}</div>
          </div>`;
      }).join('')}
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  RESTRIÇÃO / SURVIVAL
// ════════════════════════════════════════════════════════════
const RESTRICT_PRESETS = [
  { id: 'budget',  emoji: '💰', label: 'Orçamento de OVR', desc: 'Soma dos overalls dos 11 ≤ 920.', mode: 'restrict', restrictions: { budget: 920, label: 'Orçamento OVR 920' } },
  { id: 'nations', emoji: '🌍', label: 'Mundo Unido', desc: 'No máximo 1 jogador por país.', mode: 'restrict', restrictions: { oneCountry: true, label: '1 por país' } },
  { id: 'survival',emoji: '🔥', label: 'Survival', desc: 'Enfrente rodadas cada vez mais fortes até perder.', mode: 'survival', restrictions: null },
];

function startRestrict() {
  state.isMultiplayer = false;
  renderRestrictScreen();
  goTo('restrict');
}

function renderRestrictScreen() {
  const el = document.getElementById('restrict-content');
  el.innerHTML = `
    <p class="restrict-info">Escolha um desafio especial. As regras valem durante a montagem do time.</p>
    <div class="restrict-grid">
      ${RESTRICT_PRESETS.map(r => `
        <div class="restrict-card" data-restrict="${r.id}">
          <div class="restrict-emoji">${r.emoji}</div>
          <div class="restrict-name">${r.label}</div>
          <div class="restrict-desc">${r.desc}</div>
        </div>`).join('')}
    </div>`;
  el.querySelectorAll('.restrict-card').forEach(card => {
    card.addEventListener('click', () => {
      const preset = RESTRICT_PRESETS.find(r => r.id === card.dataset.restrict);
      state.gameMode = preset.mode;
      state.restrictions = preset.restrictions;
      state.mode = 'classic';
      goTo('formation');
      renderFormationGrid();
    });
  });
}

// ════════════════════════════════════════════════════════════
//  PÓS-TORNEIO (recompensas, conquistas, ranking)
// ════════════════════════════════════════════════════════════
async function onTournamentComplete(simResult) {
  const players = state.slots.map(s => s.player).filter(Boolean);

  // Conquistas (engine)
  if (typeof evaluateAchievements === 'function') {
    const ctx = { result: simResult, players, mode: state.gameMode, restrictions: state.restrictions };
    const ids = evaluateAchievements(ctx);
    if (ids.length && typeof Profile !== 'undefined') {
      const fresh = await Profile.unlockAchievements(ids);
      fresh.forEach((id, i) => {
        const a = (typeof ACHIEVEMENTS !== 'undefined') ? ACHIEVEMENTS.find(x => x.id === id) : null;
        if (a) setTimeout(() => showToast(`${a.emoji} Conquista: ${a.label}`), 800 + i * 1200);
      });
    }
  }

  if (state.gameMode === 'daily') {
    const date = todayStr();
    const score = tournamentScore(simResult);
    await Profile.save({ lastDaily: date });
    await Profile.submitDaily(date, score, { overall: simResult.stats.overall, chemistry: simResult.chemistry, stages: simResult.stagesReached });
    showToast(`Pontuação do dia: ${score}`);
  } else if (state.gameMode === 'career') {
    const p = Profile.get();
    const coins = simResult.stagesReached * 30 + (simResult.champion ? 300 : 0) + Math.round(simResult.chemistry || 0);
    await Profile.save({
      coins: (p.coins || 0) + coins,
      careerRound: (p.careerRound || 1) + 1,
      careerWins: (p.careerWins || 0) + (simResult.champion ? 1 : 0),
    });
    setTimeout(() => showToast(`🪙 +${coins} moedas! Rodada ${Profile.get().careerRound}`), 600);
  } else if (state.gameMode === 'survival') {
    const score = simResult.stagesReached;
    showToast(`🔥 Você sobreviveu a ${score} rodada(s)!`);
  }
}
