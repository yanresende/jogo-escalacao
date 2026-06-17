/* ============================================================
   7a0 — Motor de Simulação
   Fórmulas exatas obtidas por engenharia reversa do jogo original
   ============================================================ */

// ── PRNG com seed (Mulberry32) ────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Distribuição de Poisson (módulo 7794) ─────────────────────
function poisson(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// ── Pesos de gol por posição (módulo 6564) ────────────────────
const SCORER_WEIGHTS = {
  ST:  1.0, RW: 1.0,  LW: 1.0,
  CAM: 0.7,
  CM:  0.45, LM: 0.45, RM: 0.45,
  CDM: 0.22,
  CB:  0.12, RB: 0.12, LB: 0.12, LWB: 0.12, RWB: 0.12,
  GK:  0.01,
};

// Easter Egg: goleiros artilheiros históricos
const SCORING_GK_EASTER_EGG = new Set([
  "rogerio-ceni-bra-02",
  "rogerio-ceni-bra-06",
  "chilavert-par-98",
  "higuita-col-90",
]);

// ── Roleta ponderada de artilheiro ────────────────────────────
function pickGoalScorer(players, rng) {
  const weights = players.map(p => {
    const base = SCORER_WEIGHTS[p.position] ?? 0.45;
    const w = (p.position === 'GK' && SCORING_GK_EASTER_EGG.has(p.id)) ? 0.25 : base;
    return p.overall * w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

// ── Minuto do gol (distribuição não-linear) ───────────────────
function goalMinute(rng) {
  return 1 + Math.floor(90 * Math.pow(rng(), 0.85));
}

// ── Calcular stats do time ────────────────────────────────────
function calcTeamStats(players) {
  const weightMap = {
    ST:  { atk: 1.0,  def: 0.0  },
    LW:  { atk: 0.85, def: 0.0  },
    RW:  { atk: 0.85, def: 0.0  },
    CAM: { atk: 0.75, def: 0.1  },
    LM:  { atk: 0.5,  def: 0.5  },
    RM:  { atk: 0.5,  def: 0.5  },
    CM:  { atk: 0.5,  def: 0.5  },
    CDM: { atk: 0.2,  def: 0.6  },
    LWB: { atk: 0.3,  def: 0.8  },
    RWB: { atk: 0.3,  def: 0.8  },
    LB:  { atk: 0.1,  def: 0.8  },
    RB:  { atk: 0.1,  def: 0.8  },
    CB:  { atk: 0.0,  def: 0.95 },
    GK:  { atk: 0.0,  def: 1.0  },
  };

  let atkSum = 0, atkW = 0, defSum = 0, defW = 0;
  for (const p of players) {
    const w = weightMap[p.position] || { atk: 0.5, def: 0.5 };
    atkSum += p.overall * w.atk;
    atkW   += w.atk;
    defSum += p.overall * w.def;
    defW   += w.def;
  }
  return {
    attack:  atkW > 0 ? Math.round(atkSum / atkW) : 75,
    defense: defW > 0 ? Math.round(defSum / defW) : 75,
    overall: Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length),
  };
}

// ── Simular uma partida (módulo 8860 × 5177) ─────────────────
function simulateMatch(teamStats, opponentStrength, rng, players) {
  const lambdaFor     = Math.min(5, Math.max(0.15, 1.4 + (teamStats.attack  - opponentStrength) * 0.08));
  const lambdaAgainst = Math.min(5, Math.max(0.15, 1.4 + (opponentStrength  - teamStats.defense) * 0.08));

  const goalsFor     = poisson(lambdaFor,     rng);
  const goalsAgainst = poisson(lambdaAgainst, rng);

  const eventsFor = [];
  for (let i = 0; i < goalsFor; i++) {
    const scorer = players ? pickGoalScorer(players, rng) : null;
    eventsFor.push({ scorer, minute: goalMinute(rng) });
  }
  eventsFor.sort((a, b) => a.minute - b.minute);

  const eventsAgainst = [];
  for (let i = 0; i < goalsAgainst; i++) {
    eventsAgainst.push({ minute: goalMinute(rng) });
  }
  eventsAgainst.sort((a, b) => a.minute - b.minute);

  return { goalsFor, goalsAgainst, eventsFor, eventsAgainst };
}

// ── Força dos adversários por fase ───────────────────────────
const STAGE_CONFIG = [
  { id: 'group1',  label: 'Fase de Grupos — Jogo 1', strength: 68 },
  { id: 'group2',  label: 'Fase de Grupos — Jogo 2', strength: 71 },
  { id: 'group3',  label: 'Fase de Grupos — Jogo 3', strength: 74 },
  { id: 'r16',     label: 'Oitavas de Final',         strength: 79 },
  { id: 'qf',      label: 'Quartas de Final',         strength: 83 },
  { id: 'sf',      label: 'Semifinal',                strength: 87 },
  { id: 'final',   label: 'Final',                    strength: 91 },
];

// ── Simular torneio completo ──────────────────────────────────
function simulateTournament(players, seed) {
  const rng   = mulberry32(seed);
  const stats = calcTeamStats(players);
  const results = [];
  let eliminated = false;

  for (const stage of STAGE_CONFIG) {
    if (eliminated) {
      results.push({ ...stage, goalsFor: null, goalsAgainst: null, eventsFor: [], eventsAgainst: [], status: 'skipped' });
      continue;
    }

    const match = simulateMatch(stats, stage.strength, rng, players);
    const win   = match.goalsFor > match.goalsAgainst;
    const draw  = match.goalsFor === match.goalsAgainst;

    const isGroup  = stage.id.startsWith('group');
    const advanced = isGroup ? (win || draw) : win;

    if (!isGroup && !win) eliminated = true;

    results.push({
      ...stage,
      goalsFor:      match.goalsFor,
      goalsAgainst:  match.goalsAgainst,
      eventsFor:     match.eventsFor,
      eventsAgainst: match.eventsAgainst,
      win,
      draw,
      advanced,
      status: advanced ? 'win' : 'loss',
    });

    if (!advanced) eliminated = true;
  }

  const finalResult = results[results.length - 1];
  const champion = finalResult.status === 'win';
  const reached  = results.filter(r => r.status !== 'skipped').length;

  return { results, stats, champion, stagesReached: reached, seed };
}

// ── Simular partida multiplayer (cliente) ─────────────────────
function simulateMultiplayerMatchClient(playersA, playersB, seed) {
  const rng    = mulberry32(seed);
  const statsA = calcTeamStats(playersA);
  const statsB = calcTeamStats(playersB);

  const lambdaAFor = Math.min(5, Math.max(0.15, 1.4 + (statsA.attack - statsB.defense) * 0.08));
  const lambdaBFor = Math.min(5, Math.max(0.15, 1.4 + (statsB.attack - statsA.defense) * 0.08));

  const goalsA = poisson(lambdaAFor, rng);
  const goalsB = poisson(lambdaBFor, rng);

  const eventsA = [];
  for (let i = 0; i < goalsA; i++) {
    eventsA.push({ scorer: pickGoalScorer(playersA, rng), minute: goalMinute(rng) });
  }
  eventsA.sort((a, b) => a.minute - b.minute);

  const eventsB = [];
  for (let i = 0; i < goalsB; i++) {
    eventsB.push({ scorer: pickGoalScorer(playersB, rng), minute: goalMinute(rng) });
  }
  eventsB.sort((a, b) => a.minute - b.minute);

  return { goalsA, goalsB, statsA, statsB, eventsA, eventsB };
}

// ── Gerar seed de jogo ────────────────────────────────────────
function generateSeed() {
  return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
}

// ── Share code (Base64 dos IDs dos jogadores) ─────────────────
function encodeTeam(players) {
  const ids = players.map(p => p.id).join(',');
  return btoa(ids);
}

function decodeTeam(code) {
  try {
    const ids = atob(code).split(',');
    return ids.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
  } catch {
    return null;
  }
}
