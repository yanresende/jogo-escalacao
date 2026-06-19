/* ============================================================
   7a0 — Game Logic (State Machine + Draft)
   ============================================================ */

// Formações fiéis às imagens em /public/formações (rótulos PT: GOL, ZAG, LE/LD,
// VOL, MC, MEI, ME/MD, PE/PD, CA). slots[] e FIELD_POSITIONS[] são paralelos.
const FORMATIONS = {
  '4-3-3':   { slots: ['GK','LB','CB','CB','RB','CDM','CAM','CM','LW','ST','RW'],     desc: 'Balanceada e versátil' },
  '4-4-2':   { slots: ['GK','LB','CB','CB','RB','LM','CM','CDM','RM','ST','ST'],      desc: 'Clássica com dois atacantes' },
  '4-2-3-1': { slots: ['GK','LB','CB','CB','RB','CDM','CM','LW','CAM','RW','ST'],     desc: 'Sólida no meio-campo' },
  '4-2-4':   { slots: ['GK','LB','CB','CB','RB','CDM','CM','LW','ST','ST','RW'],      desc: 'Ofensiva com 4 na frente' },
  '3-5-2':   { slots: ['GK','CB','CB','CB','LM','CM','CDM','CM','RM','ST','ST'],      desc: 'Defensiva com alas ofensivos' },
  '5-3-2':   { slots: ['GK','LB','CB','CB','CB','RB','CDM','CM','CAM','ST','ST'],     desc: 'Muito sólida atrás' },
  '4-5-1':   { slots: ['GK','LB','CB','CB','RB','LM','CAM','CDM','CM','RM','ST'],     desc: 'Ultra defensiva' },
  '3-4-3':   { slots: ['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'],       desc: 'Ataque total' },
};

// Posições no campo [y% (0=ataque/topo, 100=goleiro/base), x% (0=esquerda)].
// Cada formação: 11 pares [y, x] — mesma ordem dos slots acima.
const FIELD_POSITIONS = {
  '4-3-3': [
    [90, 50],                                   // GOL
    [73, 18], [74, 39], [74, 61], [73, 82],     // LE ZAG ZAG LD
    [60, 50], [48, 37], [48, 63],               // VOL  MEI MC
    [27, 20], [18, 50], [27, 80],               // PE CA PD
  ],
  '4-4-2': [
    [90, 50],
    [73, 18], [74, 39], [74, 61], [73, 82],     // LE ZAG ZAG LD
    [52, 16], [49, 40], [49, 60], [52, 84],     // ME MC VOL MD
    [20, 38], [20, 62],                         // CA CA
  ],
  '4-2-3-1': [
    [90, 50],
    [73, 18], [74, 39], [74, 61], [73, 82],     // LE ZAG ZAG LD
    [60, 40], [60, 60],                         // VOL MC
    [40, 18], [38, 50], [40, 82],               // PE MEI PD
    [18, 50],                                   // CA
  ],
  '4-2-4': [
    [90, 50],
    [73, 18], [74, 39], [74, 61], [73, 82],     // LE ZAG ZAG LD
    [55, 40], [55, 60],                         // VOL MC
    [26, 15], [22, 40], [22, 60], [26, 85],     // PE CA CA PD
  ],
  '3-5-2': [
    [90, 50],
    [74, 30], [75, 50], [74, 70],               // ZAG ZAG ZAG
    [50, 12], [55, 35], [46, 50], [55, 65], [50, 88], // ME MC VOL MC MD
    [20, 38], [20, 62],                         // CA CA
  ],
  '5-3-2': [
    [90, 50],
    [72, 12], [75, 32], [76, 50], [75, 68], [72, 88], // LE ZAG ZAG ZAG LD
    [52, 33], [49, 50], [52, 67],               // VOL MC MEI
    [22, 38], [22, 62],                         // CA CA
  ],
  '4-5-1': [
    [90, 50],
    [73, 18], [74, 39], [74, 61], [73, 82],     // LE ZAG ZAG LD
    [50, 12], [48, 37], [58, 50], [48, 63], [50, 88], // ME MEI VOL MC MD
    [20, 50],                                   // CA
  ],
  '3-4-3': [
    [90, 50],
    [74, 30], [75, 50], [74, 70],               // ZAG ZAG ZAG
    [52, 15], [52, 40], [52, 60], [52, 85],     // ME MC MC MD
    [25, 20], [20, 50], [25, 80],               // PE CA PD
  ],
};

// Rótulos das posições em português (como nas imagens das formações).
const POS_LABELS = {
  GK: 'GOL', CB: 'ZAG', LB: 'LE', RB: 'LD', LWB: 'ALE', RWB: 'ALD',
  CDM: 'VOL', CM: 'MC', CAM: 'MEI', LM: 'ME', RM: 'MD',
  LW: 'PE', RW: 'PD', ST: 'CA', CF: 'CA', SS: 'SA',
};
function posLabel(pos) { return POS_LABELS[pos] || pos; }

// ── Game State ────────────────────────────────────────────────
const state = {
  screen:       'menu',       // Current screen
  mode:         'classic',    // 'classic' | 'memory'
  formation:    null,         // Selected formation key
  slots:        [],           // Array of { pos, player|null }
  wildcards:    3,
  currentRoll:  null,         // { squad, players (filtered) }
  pickedPlayers:[],           // Players drafted so far
  seed:         null,
  isMultiplayer:false,
  simResults:   null,
  tactic:       'equilibrada', // chave de TACTICS (engine.js)
  captainId:    null,          // id do jogador capitão
  penaltyOrder: null,          // ordem de batedores de pênalti (ids) — multiplayer
  gameMode:     'solo',        // 'solo' | 'daily' | 'career' | 'survival'
  restrictions: null,          // { budget?, oneCountry?, label } | null
  dailySeq:     null,          // sequência determinística de squads (modo diário)
  dailyPtr:     0,
  dailySeed:    null,
};

// Opções de simulação derivadas do estado atual (tática, capitão, slots, fases por modo).
function currentSimOpts() {
  const opts = {
    tactic:    state.tactic,
    captainId: state.captainId,
    slots:     state.slots.map(s => s.pos),
  };
  if (state.gameMode === 'career') {
    const round = (typeof Profile !== 'undefined') ? (Profile.get().careerRound || 1) : 1;
    const bump = (round - 1) * 2;
    opts.stages = STAGE_CONFIG.map(s => ({ ...s, strength: s.strength + bump }));
  } else if (state.gameMode === 'survival') {
    opts.stages = buildSurvivalStages();
  }
  return opts;
}

// Survival: fases infinitas (cresce a força até o jogador perder).
function buildSurvivalStages() {
  const stages = [];
  for (let i = 0; i < 18; i++) {
    stages.push({ id: 'sv' + i, label: `Rodada ${i + 1}`, strength: 66 + i * 2 });
  }
  return stages;
}

// ── Navigation helpers ────────────────────────────────────────
function goTo(screen) {
  state.screen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.classList.add('active');
}

// ── Init draft ────────────────────────────────────────────────
function initDraft(formation) {
  state.formation = formation;
  state.slots = FORMATIONS[formation].slots.map(pos => ({ pos, player: null }));
  const bonus = (typeof Profile !== 'undefined' && state.gameMode === 'career') ? (Profile.get().bonusWildcards || 0) : 0;
  state.wildcards = 3 + bonus;
  state.currentRoll = null;
  state.pickedPlayers = [];
  state.seed = generateSeed();
  state.tactic = null;
  state.captainId = null;
  state.penaltyOrder = null;
  state.dailySeq = null;
  state.dailyPtr = 0;
}

// Modos single-player que rodam o torneio de bots (grupos + mata-mata) localmente.
// Survival mantém a campanha antiga (fases infinitas escalando).
function isLocalTournamentMode() {
  return !state.isMultiplayer && ['solo', 'daily', 'career', 'restrict'].includes(state.gameMode);
}

// ── Get open slots ────────────────────────────────────────────
function getOpenSlots() {
  return state.slots.filter(s => !s.player);
}

function getOpenPositions() {
  return [...new Set(getOpenSlots().map(s => s.pos))];
}

function isDraftComplete() {
  return state.slots.every(s => s.player !== null);
}

// ── Roll dice ─────────────────────────────────────────────────
function rollDice() {
  // Modo diário: sequência determinística de seleções (mesmo "dado" para todos)
  if (state.gameMode === 'daily' && state.dailySeq && state.dailySeq.length) {
    const squad = state.dailySeq[state.dailyPtr % state.dailySeq.length];
    state.dailyPtr++;
    state.currentRoll = { squad, players: squad.players };
    return state.currentRoll;
  }

  const openPositions = getOpenPositions();
  if (openPositions.length === 0) return null;

  // Pick a random squad from database
  const eligible = SQUAD_LIST.filter(squad =>
    squad.players.some(p => openPositions.some(op => playerFitsSlot(p, op)))
  );
  if (eligible.length === 0) return null;

  const squad = eligible[Math.floor(Math.random() * eligible.length)];
  state.currentRoll = { squad, players: squad.players };
  return state.currentRoll;
}

// ── Use wildcard ──────────────────────────────────────────────
function useWildcard() {
  if (state.wildcards <= 0) return false;
  state.wildcards--;
  state.currentRoll = null;
  return true;
}

// ── Reroll: manter Copa, mudar País ──────────────────────────
function rollSameYear() {
  if (state.wildcards <= 0 || !state.currentRoll) return null;
  const currentYear = state.currentRoll.squad.worldCup;
  const openPositions = getOpenPositions();

  const eligible = SQUAD_LIST.filter(squad =>
    squad.worldCup === currentYear &&
    squad.country !== state.currentRoll.squad.country &&
    squad.players.some(p => openPositions.some(op => playerFitsSlot(p, op)))
  );
  if (eligible.length === 0) return null;

  state.wildcards--;
  const squad = eligible[Math.floor(Math.random() * eligible.length)];
  state.currentRoll = { squad, players: squad.players };
  return state.currentRoll;
}

// ── Reroll: manter País, mudar Copa ──────────────────────────
function rollSameCountry() {
  if (state.wildcards <= 0 || !state.currentRoll) return null;
  const currentCountry = state.currentRoll.squad.country;
  const openPositions = getOpenPositions();

  const eligible = SQUAD_LIST.filter(squad =>
    squad.country === currentCountry &&
    squad.worldCup !== state.currentRoll.squad.worldCup &&
    squad.players.some(p => openPositions.some(op => playerFitsSlot(p, op)))
  );
  if (eligible.length === 0) return null;

  state.wildcards--;
  const squad = eligible[Math.floor(Math.random() * eligible.length)];
  state.currentRoll = { squad, players: squad.players };
  return state.currentRoll;
}

// ── Restrições (modos Restrição/Survival) ─────────────────────
function canPickPlayer(player) {
  const r = state.restrictions;
  if (!r) return { ok: true };
  if (r.oneCountry && state.slots.some(s => s.player && s.player.country === player.country)) {
    return { ok: false, reason: `Regra: 1 jogador por país. Já há um de ${player.country}.` };
  }
  if (r.budget) {
    const sum = state.slots.reduce((a, s) => a + (s.player ? s.player.overall : 0), 0);
    if (sum + player.overall > r.budget) {
      return { ok: false, reason: `Estouraria o orçamento de OVR (${r.budget}).` };
    }
  }
  return { ok: true };
}

// ── Pick player em slot específico ────────────────────────────
function pickPlayerToSlot(playerId, slotIndex) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return false;
  if (state.slots.some(s => s.player && s.player.id === playerId)) return false; // já escalado
  const slot = state.slots[slotIndex];
  if (!slot || slot.player) return false;
  if (!playerFitsSlot(player, slot.pos)) return false;
  const allowed = canPickPlayer(player);
  if (!allowed.ok) { if (typeof showToast === 'function') showToast(allowed.reason); return false; }

  slot.player = player;
  state.pickedPlayers.push(player);
  state.currentRoll = null;
  return true;
}

// ── Remover jogador de um slot ────────────────────────────────
function removePlayerFromSlot(slotIndex) {
  const slot = state.slots[slotIndex];
  if (!slot || !slot.player) return false;
  slot.player = null;
  state.pickedPlayers = state.slots.filter(s => s.player).map(s => s.player);
  return true;
}

// ── Trocar posição de jogadores já escalados ──────────────────
function movePlayer(fromIndex, toIndex) {
  const from = state.slots[fromIndex];
  const to = state.slots[toIndex];
  if (!from || !to) return false;
  if (from.player && !playerFitsSlot(from.player, to.pos)) return false;
  if (to.player && !playerFitsSlot(to.player, from.pos)) return false;

  const temp = from.player;
  from.player = to.player;
  to.player = temp;
  state.pickedPlayers = state.slots.filter(s => s.player).map(s => s.player);
  return true;
}

// ── Pick player ───────────────────────────────────────────────
function pickPlayer(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return false;
  if (state.slots.some(s => s.player && s.player.id === playerId)) return false; // já escalado
  const allowed = canPickPlayer(player);
  if (!allowed.ok) { if (typeof showToast === 'function') showToast(allowed.reason); return false; }

  const openPositions = getOpenPositions();
  // Find best slot fit
  let targetSlot = null;
  // Exact match first
  for (const op of openPositions) {
    if (state.slots.find(s => !s.player && s.pos === op && playerFitsSlot(player, op))) {
      targetSlot = state.slots.find(s => !s.player && s.pos === op);
      if (player.position === op || (player.altPositions && player.altPositions.includes(op))) break; // prefer exact
    }
  }
  if (!targetSlot) {
    // fallback: any open slot where player fits
    targetSlot = state.slots.find(s => !s.player && playerFitsSlot(player, s.pos));
  }
  if (!targetSlot) return false;

  targetSlot.player = player;
  state.pickedPlayers.push(player);
  state.currentRoll = null;
  return true;
}

// ── Get next open slot position (for display) ─────────────────
function getNextOpenPosition() {
  const open = getOpenSlots();
  return open.length > 0 ? open[0].pos : null;
}

// ── Team share ────────────────────────────────────────────────
function shareTeam() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  const code = encodeTeam(players);
  const url = `${location.origin}${location.pathname}?team=${code}`;
  navigator.clipboard.writeText(url).catch(() => {});
  return url;
}

// ── Load team from URL ─────────────────────────────────────────
function loadTeamFromURL() {
  const params = new URLSearchParams(location.search);
  const code = params.get('team');
  if (!code) return false;

  const players = decodeTeam(code);
  if (!players || players.length !== 11) return false;

  // Detect formation from player count per position group
  // Use first formation as default
  const formation = '4-3-3';
  initDraft(formation);
  players.forEach((p, i) => {
    if (state.slots[i]) state.slots[i].player = p;
  });
  state.pickedPlayers = players;
  return true;
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Check URL for shared team
  if (loadTeamFromURL()) {
    state.screen = 'simulation';
    renderSimulation();
    goTo('simulation');
    return;
  }

  // Wire up buttons
  document.getElementById('btn-solo').addEventListener('click', () => {
    state.isMultiplayer = false;
    state.gameMode = 'solo';
    state.restrictions = null;
    goTo('mode');
  });

  document.getElementById('btn-multi').addEventListener('click', () => {
    state.isMultiplayer = true;
    state.gameMode = 'solo';
    state.restrictions = null;
    goTo('lobby');
  });

  // Novos modos (lógica em modes.js)
  const dailyBtn = document.getElementById('btn-daily');
  if (dailyBtn) dailyBtn.addEventListener('click', () => { if (typeof startDaily === 'function') startDaily(); });
  const careerBtn = document.getElementById('btn-career');
  if (careerBtn) careerBtn.addEventListener('click', () => { if (typeof startCareer === 'function') startCareer(); });
  const survivalBtn = document.getElementById('btn-survival');
  if (survivalBtn) survivalBtn.addEventListener('click', () => { if (typeof startRestrict === 'function') startRestrict(); });

  ['back-from-career', 'back-from-daily', 'back-from-restrict'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => goTo('menu'));
  });
  const backAchv = document.getElementById('back-from-achievements');
  if (backAchv) backAchv.addEventListener('click', () => goTo('career'));

  document.getElementById('back-from-mode').addEventListener('click', () => goTo('menu'));
  document.getElementById('back-from-formation').addEventListener('click', () => goTo(state.isMultiplayer ? 'lobby' : 'mode'));
  document.getElementById('back-from-lobby').addEventListener('click', () => goTo('menu'));

  document.getElementById('mode-classic').addEventListener('click', () => {
    state.mode = 'classic';
    goTo('formation');
    renderFormationGrid();
  });
  document.getElementById('mode-memory').addEventListener('click', () => {
    state.mode = 'memory';
    goTo('formation');
    renderFormationGrid();
  });

  document.getElementById('dice-btn').addEventListener('click', onDiceClick);
  document.getElementById('reroll-year-btn').addEventListener('click', onRerollYearClick);
  document.getElementById('reroll-country-btn').addEventListener('click', onRerollCountryClick);
  // btn-simulate is handled by ui.js (animated version)
  document.getElementById('btn-share').addEventListener('click', onShare);
  document.getElementById('btn-play-again').addEventListener('click', onPlayAgain);
  document.getElementById('btn-match-again').addEventListener('click', onPlayAgain);

  goTo('menu');
});

function onDiceClick() {
  const roll = rollDice();
  if (!roll) return;
  renderDraftPick(roll);
  document.getElementById('dice-btn').classList.add('rolling');
  setTimeout(() => document.getElementById('dice-btn').classList.remove('rolling'), 500);
  updateRerollBtns();
}

function onRerollYearClick() {
  const roll = rollSameYear();
  if (!roll) { showToast('Nenhuma outra seleção disponível para essa Copa!'); return; }
  renderDraftPick(roll);
  updateRerollBtns();
  renderWildcards();
}

function onRerollCountryClick() {
  const roll = rollSameCountry();
  if (!roll) { showToast('Nenhuma outra Copa disponível para esse país!'); return; }
  renderDraftPick(roll);
  updateRerollBtns();
  renderWildcards();
}

function updateRerollBtns() {
  const hasRoll = !!state.currentRoll;
  const hasWildcards = state.wildcards > 0;
  const yearBtn = document.getElementById('reroll-year-btn');
  const countryBtn = document.getElementById('reroll-country-btn');
  const remaining = document.getElementById('wildcards-remaining');
  if (yearBtn) yearBtn.disabled = !hasRoll || !hasWildcards;
  if (countryBtn) countryBtn.disabled = !hasRoll || !hasWildcards;
  if (remaining) remaining.textContent = state.wildcards;
}

function onSimulate() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  if (players.length < 11) { showToast('Monte o time completo primeiro!'); return; }
  const seed = generateSeed();
  state.simResults = simulateTournament(players, seed, currentSimOpts());
  renderResults(state.simResults, players);
  goTo('results');
}

function onShare() {
  const url = shareTeam();
  showToast('Link copiado para a área de transferência!');
}

function onPlayAgain() {
  const prevMode = state.gameMode;
  if (state.isMultiplayer && typeof resetMultiplayer === 'function') {
    resetMultiplayer();
    state.formation = null;
    state.slots = [];
    state.pickedPlayers = [];
    state.simResults = null;
    state.gameMode = 'solo';
    goTo('menu');
    return;
  }
  state.formation = null;
  state.slots = [];
  state.currentRoll = null;
  state.pickedPlayers = [];
  state.simResults = null;
  state.tactic = 'equilibrada';
  state.captainId = null;
  state.penaltyOrder = null;
  state.dailySeq = null;
  state.dailyPtr = 0;

  // Volta para o hub do modo, mantendo o contexto quando faz sentido
  if (prevMode === 'career' && typeof renderCareerScreen === 'function') {
    renderCareerScreen();
    goTo('career');
    return;
  }
  if (prevMode === 'daily' && typeof renderDailyScreen === 'function') {
    renderDailyScreen();
    goTo('daily');
    return;
  }
  state.gameMode = 'solo';
  state.restrictions = null;
  goTo('menu');
}
