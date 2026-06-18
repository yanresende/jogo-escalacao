/* ============================================================
   7a0 — Motor de Simulação (compartilhado client + server)
   Padrão UMD: no browser exporta globais; no Node, module.exports.
   Fórmulas Poisson + química por estilo de jogo + táticas + capitão.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node (server.js)
  } else {
    Object.assign(root, api);        // Browser (globais)
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── PRNG com seed (Mulberry32) ──────────────────────────────
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Distribuição de Poisson (inversão) ──────────────────────
  function poisson(lambda, rng) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }

  // pmf de Poisson — usado no cálculo de probabilidade de vitória
  function poissonPmf(lambda, k) {
    let logp = -lambda + k * Math.log(lambda);
    for (let i = 2; i <= k; i++) logp -= Math.log(i);
    return Math.exp(logp);
  }

  // ════════════════════════════════════════════════════════════
  //  ESTILOS DE JOGO
  // ════════════════════════════════════════════════════════════
  // Catálogo de estilos. label/emoji usados na UI.
  const PLAY_STYLES = {
    retranca:        { label: 'Retranca',      emoji: '🛡️', desc: 'Sólido na marcação' },
    'contra-ataque': { label: 'Contra-ataque', emoji: '⚡', desc: 'Velocidade e transição' },
    posse:           { label: 'Posse',         emoji: '🎯', desc: 'Toque e controle' },
    drible:          { label: 'Drible',        emoji: '🪄', desc: 'Talento individual' },
    fisico:          { label: 'Físico',        emoji: '💪', desc: 'Força e imposição' },
    armador:         { label: 'Armador',       emoji: '🧠', desc: 'Visão e passe' },
    goleador:        { label: 'Goleador',      emoji: '🎰', desc: 'Faro de gol' },
  };

  // Estilo padrão por posição quando o jogador não tem `style` anotado.
  const STYLE_BY_POSITION = {
    GK: 'retranca',
    CB: 'retranca', CDM: 'retranca',
    LB: 'contra-ataque', RB: 'contra-ataque', LWB: 'contra-ataque', RWB: 'contra-ataque',
    LM: 'contra-ataque', RM: 'contra-ataque',
    CM: 'posse',
    CAM: 'armador',
    LW: 'drible', RW: 'drible',
    ST: 'goleador',
  };

  function getStyle(player) {
    if (player && player.style && PLAY_STYLES[player.style]) return player.style;
    return STYLE_BY_POSITION[player && player.position] || 'posse';
  }

  // Pares de estilos que se complementam (sinergia forte).
  const SYNERGIES = [
    ['armador', 'goleador'],
    ['contra-ataque', 'retranca'],
    ['posse', 'drible'],
    ['fisico', 'goleador'],
    ['armador', 'drible'],
    ['posse', 'armador'],
    ['contra-ataque', 'fisico'],
  ];
  const SYNERGY_SET = new Set(SYNERGIES.map(([a, b]) => a + '|' + b).concat(SYNERGIES.map(([a, b]) => b + '|' + a)));

  // Retorna 2 (sinergia listada), 1 (mesmo estilo) ou 0.
  function styleSynergy(s1, s2) {
    if (s1 === s2) return 1;
    return SYNERGY_SET.has(s1 + '|' + s2) ? 2 : 0;
  }

  // ════════════════════════════════════════════════════════════
  //  TÁTICAS
  // ════════════════════════════════════════════════════════════
  // baseFor/baseAgainst: deslocam a base do lambda (antes fixa em 1.4).
  // favors: estilos premiados em química/OVR efetivo nessa tática.
  // counter: bônus condicional quando o adversário é mais forte.
  const TACTICS = {
    equilibrada:      { label: 'Equilibrada',   emoji: '⚖️',  baseFor: 0.0,  baseAgainst: 0.0,  favors: [],                                    counter: false },
    ofensiva:         { label: 'Ofensiva',      emoji: '🔥',  baseFor: 0.35, baseAgainst: 0.30, favors: ['goleador', 'drible', 'posse'],       counter: false },
    defensiva:        { label: 'Defensiva',     emoji: '🧱',  baseFor: -0.30, baseAgainst: -0.40, favors: ['retranca', 'fisico'],              counter: false },
    'contra-ataque':  { label: 'Contra-ataque', emoji: '⚡',  baseFor: 0.10, baseAgainst: -0.10, favors: ['contra-ataque', 'goleador', 'fisico'], counter: true },
    posse:            { label: 'Posse de bola', emoji: '🎯',  baseFor: 0.20, baseAgainst: -0.05, favors: ['posse', 'armador', 'drible'],        counter: false },
  };
  const DEFAULT_TACTIC = 'equilibrada';

  function getTactic(tactic) {
    return TACTICS[tactic] || TACTICS[DEFAULT_TACTIC];
  }

  // ════════════════════════════════════════════════════════════
  //  QUÍMICA
  // ════════════════════════════════════════════════════════════
  // calcChemistry(players, opts) → { chemistry, links, styleFit, perPlayer }
  //   opts: { tactic, captainId, slots? }  (slots = posições esperadas, paralelo a players)
  function calcChemistry(players, opts) {
    opts = opts || {};
    const tac = getTactic(opts.tactic);
    const captainId = opts.captainId || null;
    const slots = opts.slots || null;
    const n = players.length || 1;

    const styles = players.map(getStyle);
    const captainIdx = captainId ? players.findIndex(p => p.id === captainId) : -1;
    const captainStyle = captainIdx >= 0 ? styles[captainIdx] : null;

    // Sinergia par a par
    let linkScore = 0;
    const links = [];
    const perPlayerSyn = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s = styleSynergy(styles[i], styles[j]);
        if (s > 0) {
          linkScore += s;
          perPlayerSyn[i] += s;
          perPlayerSyn[j] += s;
          links.push({ a: i, b: j, type: s >= 2 ? 'strong' : 'weak' });
        }
      }
    }
    const maxLink = (n * (n - 1) / 2) * 2 || 1;

    // Alinhamento com a tática
    let tacticMatches = 0;
    for (let i = 0; i < n; i++) if (tac.favors.includes(styles[i])) tacticMatches++;
    const tacticScore = tacticMatches / n;

    // Bônus do capitão (estilo dele dá ênfase ao time)
    let captainMatches = 0;
    if (captainStyle) for (let i = 0; i < n; i++) if (styles[i] === captainStyle) captainMatches++;
    const captainScore = captainStyle ? (captainMatches / n) : 0;

    // Penalidade por encaixe de posição (quando slots disponíveis)
    let posPenaltyTotal = 0;
    const perPlayerPos = new Array(n).fill(0);
    if (slots) {
      for (let i = 0; i < n; i++) {
        const pen = positionPenalty(players[i], slots[i]);
        perPlayerPos[i] = pen;
        posPenaltyTotal += pen;
      }
    }

    const chemistry = clamp(Math.round(
      40 + (linkScore / maxLink) * 40 + tacticScore * 15 + captainScore * 5 - posPenaltyTotal * 1.5
    ), 0, 100);

    // Bônus de OVR efetivo por jogador
    const perPlayer = players.map((p, i) => {
      const synBonus = (perPlayerSyn[i] / ((n - 1) * 2 || 1)) * 2.5;      // até ~+2.5
      const tacBonus = tac.favors.includes(styles[i]) ? 1.5 : 0;
      const capStyleBonus = (captainStyle && styles[i] === captainStyle) ? 1 : 0;
      const capSelfBonus = (captainId && p.id === captainId) ? 1 : 0;
      const bonus = Math.min(4, synBonus + tacBonus + capStyleBonus + capSelfBonus);
      return { id: p.id, style: styles[i], bonus, posPenalty: perPlayerPos[i] };
    });

    return { chemistry, links, styleFit: tacticScore, perPlayer };
  }

  function positionPenalty(player, slotPos) {
    if (!slotPos) return 0;
    if (player.position === slotPos) return 0;
    const alts = player.altPositions || [];
    if (alts.includes(slotPos)) return 1;
    return 3; // forçado fora de função
  }

  // ── Pesos de ataque/defesa por posição ──────────────────────
  const WEIGHT_MAP = {
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

  // ── Stats do time (usa OVR efetivo via química) ─────────────
  function calcTeamStats(players, opts) {
    opts = opts || {};
    const tac = getTactic(opts.tactic);
    const chem = opts.chemistry || calcChemistry(players, opts);
    const bonusById = {};
    for (const pp of chem.perPlayer) bonusById[pp.id] = pp.bonus - (pp.posPenalty || 0);

    let atkSum = 0, atkW = 0, defSum = 0, defW = 0;
    for (const p of players) {
      const w = WEIGHT_MAP[p.position] || { atk: 0.5, def: 0.5 };
      const eff = p.overall + (bonusById[p.id] || 0);
      atkSum += eff * w.atk; atkW += w.atk;
      defSum += eff * w.def; defW += w.def;
    }
    // Ajuste tático leve sobre atk/def médios do time
    const atk = (atkW > 0 ? atkSum / atkW : 75) + tac.baseFor * 4;
    const def = (defW > 0 ? defSum / defW : 75) - tac.baseAgainst * 4;

    return {
      attack:  Math.round(atk),
      defense: Math.round(def),
      overall: Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length),
      chemistry: chem.chemistry,
    };
  }

  // ── Artilheiro ponderado ────────────────────────────────────
  const SCORER_WEIGHTS = {
    ST: 1.0, RW: 1.0, LW: 1.0,
    CAM: 0.7,
    CM: 0.45, LM: 0.45, RM: 0.45,
    CDM: 0.22,
    CB: 0.12, RB: 0.12, LB: 0.12, LWB: 0.12, RWB: 0.12,
    GK: 0.01,
  };
  const SCORING_GK_EASTER_EGG = new Set([
    'rogerio-ceni-bra-02', 'rogerio-ceni-bra-06', 'chilavert-par-98', 'higuita-col-90',
  ]);

  function pickGoalScorer(players, rng) {
    const weights = players.map(p => {
      let base = SCORER_WEIGHTS[p.position] ?? 0.45;
      if (p.position === 'GK' && SCORING_GK_EASTER_EGG.has(p.id)) base = 0.25;
      // Estilo goleador finaliza mais; armador um pouco menos.
      const style = getStyle(p);
      if (style === 'goleador') base *= 1.35;
      else if (style === 'armador') base *= 0.9;
      return p.overall * base;
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < players.length; i++) {
      r -= weights[i];
      if (r <= 0) return players[i];
    }
    return players[players.length - 1];
  }

  function goalMinute(rng) {
    return 1 + Math.floor(90 * Math.pow(rng(), 0.85));
  }

  // ── Lambda de gols (com fator determinístico por diferença) ─
  // Menos sorte: multiplicador 0.10 e piso de vantagem quando há gap grande.
  function goalLambda(myStrength, oppStrength, base) {
    const diff = myStrength - oppStrength;
    let lambda = 1.4 + (base || 0) + diff * 0.10;
    // Pequeno empurrão determinístico para gaps grandes (reduz zebra)
    if (Math.abs(diff) > 8) lambda += Math.sign(diff) * 0.15;
    return Math.min(5, Math.max(0.12, lambda));
  }

  // ── Probabilidade de vitória (Poisson × Poisson) ────────────
  function winProbability(lambdaFor, lambdaAgainst) {
    let pWin = 0, pDraw = 0;
    const fFor = [], fAg = [];
    for (let k = 0; k <= 12; k++) { fFor[k] = poissonPmf(lambdaFor, k); fAg[k] = poissonPmf(lambdaAgainst, k); }
    for (let a = 0; a <= 12; a++) {
      for (let b = 0; b <= 12; b++) {
        const p = fFor[a] * fAg[b];
        if (a > b) pWin += p; else if (a === b) pDraw += p;
      }
    }
    return { win: pWin, draw: pDraw, loss: Math.max(0, 1 - pWin - pDraw) };
  }

  // ── Simular uma partida ─────────────────────────────────────
  function simulateMatch(teamStats, opponentStrength, rng, players, tac) {
    tac = tac || getTactic();
    let baseFor = tac.baseFor, baseAgainst = -tac.baseAgainst;
    // Contra-ataque: bônus quando o adversário é mais forte que o time
    if (tac.counter && opponentStrength > teamStats.overall) baseFor += 0.35;

    const lambdaFor     = goalLambda(teamStats.attack, opponentStrength, baseFor);
    const lambdaAgainst = goalLambda(opponentStrength, teamStats.defense, baseAgainst);

    const goalsFor     = poisson(lambdaFor, rng);
    const goalsAgainst = poisson(lambdaAgainst, rng);

    const eventsFor = [];
    for (let i = 0; i < goalsFor; i++) {
      const scorer = players ? pickGoalScorer(players, rng) : null;
      eventsFor.push({ scorer, minute: goalMinute(rng) });
    }
    eventsFor.sort((a, b) => a.minute - b.minute);

    const eventsAgainst = [];
    for (let i = 0; i < goalsAgainst; i++) eventsAgainst.push({ minute: goalMinute(rng) });
    eventsAgainst.sort((a, b) => a.minute - b.minute);

    const prob = winProbability(lambdaFor, lambdaAgainst);
    return { goalsFor, goalsAgainst, eventsFor, eventsAgainst, winProbability: prob };
  }

  // ── Força dos adversários por fase ──────────────────────────
  const STAGE_CONFIG = [
    { id: 'group1', label: 'Fase de Grupos — Jogo 1', strength: 68 },
    { id: 'group2', label: 'Fase de Grupos — Jogo 2', strength: 71 },
    { id: 'group3', label: 'Fase de Grupos — Jogo 3', strength: 74 },
    { id: 'r16',    label: 'Oitavas de Final',          strength: 79 },
    { id: 'qf',     label: 'Quartas de Final',          strength: 83 },
    { id: 'sf',     label: 'Semifinal',                 strength: 87 },
    { id: 'final',  label: 'Final',                     strength: 91 },
  ];

  // ── Simular torneio completo (solo) ─────────────────────────
  // simulateTournament(players, seed, opts) — opts: { tactic, captainId, slots, stages? }
  function simulateTournament(players, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed);
    const tac = getTactic(opts.tactic);
    const chem = calcChemistry(players, opts);
    const stats = calcTeamStats(players, { tactic: opts.tactic, chemistry: chem });
    const stages = opts.stages || STAGE_CONFIG;
    const results = [];
    let eliminated = false;
    const scorerTally = {};

    for (const stage of stages) {
      if (eliminated) {
        results.push({ ...stage, goalsFor: null, goalsAgainst: null, eventsFor: [], eventsAgainst: [], status: 'skipped' });
        continue;
      }
      const match = simulateMatch(stats, stage.strength, rng, players, tac);
      const win = match.goalsFor > match.goalsAgainst;
      const draw = match.goalsFor === match.goalsAgainst;
      const isGroup = stage.id.startsWith('group');
      const advanced = isGroup ? (win || draw) : win;

      for (const e of match.eventsFor) if (e.scorer) scorerTally[e.scorer.id] = (scorerTally[e.scorer.id] || 0) + 1;

      results.push({
        ...stage,
        goalsFor: match.goalsFor, goalsAgainst: match.goalsAgainst,
        eventsFor: match.eventsFor, eventsAgainst: match.eventsAgainst,
        winProbability: match.winProbability,
        win, draw, advanced,
        status: advanced ? 'win' : 'loss',
      });
      if (!advanced) eliminated = true;
    }

    const finalResult = results[results.length - 1];
    const champion = finalResult.status === 'win';
    const reached = results.filter(r => r.status !== 'skipped').length;
    const mvp = computeMvp(players, scorerTally);

    return {
      results, stats, champion, stagesReached: reached, seed,
      chemistry: chem.chemistry, chemLinks: chem.links,
      tactic: opts.tactic || DEFAULT_TACTIC, captainId: opts.captainId || null,
      mvp, scorerTally,
    };
  }

  function computeMvp(players, tally) {
    let best = null, bestGoals = -1;
    for (const p of players) {
      const g = tally[p.id] || 0;
      if (g > bestGoals) { bestGoals = g; best = p; }
    }
    return best ? { id: best.id, name: best.name, goals: bestGoals } : null;
  }

  // ── Simular confronto direto (multiplayer) ──────────────────
  // simulateVersus(teamA, teamB, seed) — cada team: { players, slots?, tactic?, captainId? }
  function simulateVersus(teamA, teamB, seed) {
    seed = seed >>> 0;
    const rng = mulberry32(seed);
    const chemA = calcChemistry(teamA.players, teamA);
    const chemB = calcChemistry(teamB.players, teamB);
    const statsA = calcTeamStats(teamA.players, { tactic: teamA.tactic, chemistry: chemA });
    const statsB = calcTeamStats(teamB.players, { tactic: teamB.tactic, chemistry: chemB });
    const tacA = getTactic(teamA.tactic), tacB = getTactic(teamB.tactic);

    let baseAFor = tacA.baseFor, baseBFor = tacB.baseFor;
    if (tacA.counter && statsB.overall > statsA.overall) baseAFor += 0.35;
    if (tacB.counter && statsA.overall > statsB.overall) baseBFor += 0.35;

    const lambdaAFor = goalLambda(statsA.attack, statsB.defense, baseAFor - tacB.baseAgainst);
    const lambdaBFor = goalLambda(statsB.attack, statsA.defense, baseBFor - tacA.baseAgainst);

    const goalsA = poisson(lambdaAFor, rng);
    const goalsB = poisson(lambdaBFor, rng);

    const eventsA = [];
    for (let i = 0; i < goalsA; i++) eventsA.push({ scorer: pickGoalScorer(teamA.players, rng), minute: goalMinute(rng) });
    eventsA.sort((a, b) => a.minute - b.minute);
    const eventsB = [];
    for (let i = 0; i < goalsB; i++) eventsB.push({ scorer: pickGoalScorer(teamB.players, rng), minute: goalMinute(rng) });
    eventsB.sort((a, b) => a.minute - b.minute);

    return {
      goalsA, goalsB,
      statsA: { ...statsA, chemistry: chemA.chemistry },
      statsB: { ...statsB, chemistry: chemB.chemistry },
      eventsA, eventsB, seed,
    };
  }

  // ── Utilidades ──────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function generateSeed() {
    return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  // Hash string → uint32 (para seed do Desafio Diário)
  function hashStringToSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ── Share code (Base64 dos IDs) — depende de PLAYERS global ──
  function encodeTeam(players) {
    return _b64(players.map(p => p.id).join(','));
  }
  function decodeTeam(code) {
    try {
      const ids = _unb64(code).split(',');
      const db = (typeof PLAYERS !== 'undefined') ? PLAYERS : (typeof module !== 'undefined' ? [] : []);
      return ids.map(id => db.find(p => p.id === id)).filter(Boolean);
    } catch { return null; }
  }
  function _b64(s) { return (typeof btoa !== 'undefined') ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'); }
  function _unb64(s) { return (typeof atob !== 'undefined') ? atob(s) : Buffer.from(s, 'base64').toString('utf8'); }

  // ════════════════════════════════════════════════════════════
  //  CONQUISTAS
  // ════════════════════════════════════════════════════════════
  // check(ctx) onde ctx = { result, players, mode, restrictions }
  const ACHIEVEMENTS = [
    { id: 'champion',      label: 'Campeão do Mundo',   emoji: '🏆', desc: 'Vença a final.',
      check: c => c.result && c.result.champion },
    { id: 'unbeaten',      label: 'Campanha Invicta',   emoji: '🛡️', desc: 'Seja campeão sem perder nenhuma partida.',
      check: c => c.result && c.result.champion && c.result.results.every(r => r.status !== 'loss') },
    { id: 'seven_nil',     label: 'Sete a Zero',        emoji: '7️⃣', desc: 'Aplique um 7×0 (ou mais) em uma fase.',
      check: c => c.result && c.result.results.some(r => r.goalsFor >= 7 && r.goalsAgainst === 0) },
    { id: 'perfect_chem',  label: 'Entrosamento Total', emoji: '🔗', desc: 'Monte um time com química 100.',
      check: c => (c.result && c.result.chemistry >= 100) },
    { id: 'goleada_final', label: 'Show na Final',      emoji: '🎆', desc: 'Vença a final por 3 ou mais gols de diferença.',
      check: c => { const f = c.result && c.result.results.find(r => r.id === 'final' && r.status === 'win'); return !!f && (f.goalsFor - f.goalsAgainst) >= 3; } },
  ];

  function evaluateAchievements(ctx) {
    return ACHIEVEMENTS.filter(a => { try { return a.check(ctx); } catch { return false; } }).map(a => a.id);
  }

  return {
    mulberry32, poisson, poissonPmf,
    PLAY_STYLES, STYLE_BY_POSITION, getStyle, styleSynergy, SYNERGIES,
    TACTICS, DEFAULT_TACTIC, getTactic,
    calcChemistry, positionPenalty,
    WEIGHT_MAP, calcTeamStats,
    SCORER_WEIGHTS, pickGoalScorer, goalMinute, goalLambda, winProbability,
    simulateMatch, STAGE_CONFIG, simulateTournament, simulateVersus, computeMvp,
    generateSeed, hashStringToSeed, encodeTeam, decodeTeam,
    ACHIEVEMENTS, evaluateAchievements, clamp,
  };
});
