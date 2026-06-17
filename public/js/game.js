/* ============================================================
   7a0 — Game Logic (State Machine + Draft)
   ============================================================ */

const FORMATIONS = {
  '4-3-3':   { slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],       desc: 'Balanceada e versátil' },
  '4-4-2':   { slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],       desc: 'Clássica com dois atacantes' },
  '4-2-3-1': { slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','CAM','CAM','ST'],  desc: 'Sólida no meio-campo' },
  '4-2-4':   { slots: ['GK','RB','CB','CB','LB','CM','CM','RW','ST','ST','LW'],       desc: 'Ofensiva com 4 na frente' },
  '3-5-2':   { slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'],     desc: 'Defensiva com alas ofensivos' },
  '5-3-2':   { slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],     desc: 'Muito sólida atrás' },
  '4-5-1':   { slots: ['GK','RB','CB','CB','LB','RM','CM','CM','CM','LM','ST'],       desc: 'Ultra defensiva' },
  '3-4-3':   { slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],       desc: 'Ataque total' },
};

// Positions layout on field [top% (0=attack, 100=defense), left%]
// Each formation: 11 positions with [y, x] in percentage
const FIELD_POSITIONS = {
  '4-3-3': [
    [92, 50],   // GK
    [72, 80],   // RB
    [72, 60],   // CB
    [72, 40],   // CB
    [72, 20],   // LB
    [48, 70],   // CM
    [48, 50],   // CM
    [48, 30],   // CM
    [22, 80],   // RW
    [22, 50],   // ST
    [22, 20],   // LW
  ],
  '4-4-2': [
    [92, 50],
    [72, 80], [72, 60], [72, 40], [72, 20],
    [48, 80], [48, 60], [48, 40], [48, 20],
    [22, 65], [22, 35],
  ],
  '4-2-3-1': [
    [92, 50],
    [72, 80], [72, 60], [72, 40], [72, 20],
    [58, 65], [58, 35],
    [35, 70], [35, 50], [35, 30],
    [15, 50],
  ],
  '4-2-4': [
    [92, 50],
    [72, 80], [72, 60], [72, 40], [72, 20],
    [50, 65], [50, 35],
    [22, 80], [22, 60], [22, 40], [22, 20],
  ],
  '3-5-2': [
    [92, 50],
    [72, 70], [72, 50], [72, 30],
    [50, 85], [50, 65], [50, 50], [50, 35], [50, 15],
    [22, 60], [22, 40],
  ],
  '5-3-2': [
    [92, 50],
    [75, 85], [75, 68], [75, 50], [75, 32], [75, 15],
    [50, 65], [50, 50], [50, 35],
    [22, 60], [22, 40],
  ],
  '4-5-1': [
    [92, 50],
    [72, 80], [72, 60], [72, 40], [72, 20],
    [48, 85], [48, 65], [48, 50], [48, 35], [48, 15],
    [15, 50],
  ],
  '3-4-3': [
    [92, 50],
    [72, 70], [72, 50], [72, 30],
    [52, 80], [52, 57], [52, 43], [52, 20],
    [22, 75], [22, 50], [22, 25],
  ],
};

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
};

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
  state.wildcards = 3;
  state.currentRoll = null;
  state.pickedPlayers = [];
  state.seed = generateSeed();
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
  const openPositions = getOpenPositions();
  if (openPositions.length === 0) return null;

  // Pick a random squad from database
  const eligible = SQUAD_LIST.filter(squad =>
    squad.players.some(p => openPositions.some(op => playerFitsSlot(p, op)))
  );
  if (eligible.length === 0) return null;

  const squad = eligible[Math.floor(Math.random() * eligible.length)];
  const players = squad.players.filter(p =>
    openPositions.some(op => playerFitsSlot(p, op))
  );

  state.currentRoll = { squad, players };
  return state.currentRoll;
}

// ── Use wildcard ──────────────────────────────────────────────
function useWildcard() {
  if (state.wildcards <= 0) return false;
  state.wildcards--;
  state.currentRoll = null;
  return true;
}

// ── Pick player ───────────────────────────────────────────────
function pickPlayer(playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return false;

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
    goTo('mode');
  });

  document.getElementById('btn-multi').addEventListener('click', () => {
    state.isMultiplayer = true;
    goTo('lobby');
  });

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
  document.getElementById('wildcard-btn').addEventListener('click', onWildcardClick);
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
  updateWildcardBtn();
}

function onWildcardClick() {
  if (useWildcard()) {
    hideDraftPick();
    updateWildcardBtn();
    renderWildcards();
    showToast('Wildcard usado!');
  }
}

function updateWildcardBtn() {
  const btn = document.getElementById('wildcard-btn');
  btn.disabled = state.wildcards <= 0 || !state.currentRoll;
  btn.textContent = `Pular (Wildcard ${state.wildcards} restante${state.wildcards !== 1 ? 's' : ''})`;
}

function onSimulate() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  if (players.length < 11) { showToast('Monte o time completo primeiro!'); return; }
  const seed = generateSeed();
  state.simResults = simulateTournament(players, seed);
  renderResults(state.simResults, players);
  goTo('results');
}

function onShare() {
  const url = shareTeam();
  showToast('Link copiado para a área de transferência!');
}

function onPlayAgain() {
  state.formation = null;
  state.slots = [];
  state.currentRoll = null;
  state.pickedPlayers = [];
  state.simResults = null;
  goTo('menu');
}
