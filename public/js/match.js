/* ============================================================
   7a0 — Playback de partidas "ao vivo"
   Mostra cada partida DO JOGADOR minuto a minuto (relógio 1'→90' +
   gols com o nome do autor), com controles de velocidade e auto/manual
   ajustáveis durante o jogo, e revela o restante do torneio aos poucos.

   Depende de globais já carregados antes:
   - ui.js:    renderTournamentResult, renderGroupsSection,
               renderKnockoutRound, renderChampionAndPath, escapeHtml
   - game.js:  goTo (não usado aqui, navegação é feita pelos chamadores)
   Expõe: playMatchSequence(data, youId, opts), buildMatchQueue.
   ============================================================ */

// ── Preferências de playback (persistem na sessão) ────────────
const playbackPrefs = { speed: 'normal', auto: true };
const SPEED_DURATIONS = { slow: 12000, normal: 9000, fast: 6000 }; // ms p/ "90 minutos"

function loadPlaybackPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('pbPrefs') || 'null');
    if (p && SPEED_DURATIONS[p.speed]) playbackPrefs.speed = p.speed;
    if (p && typeof p.auto === 'boolean') playbackPrefs.auto = p.auto;
  } catch (e) { /* ignore */ }
}
function savePlaybackPrefs() {
  try { localStorage.setItem('pbPrefs', JSON.stringify(playbackPrefs)); } catch (e) { /* ignore */ }
}
loadPlaybackPrefs();

// Estado interno do playback corrente
let _pb = null;

function speedFactor() {
  if (_pb && _pb.multiplayer) return 1;
  return (SPEED_DURATIONS[playbackPrefs.speed] || 9000) / 9000;
}

// ════════════════════════════════════════════════════════════
//  FILA DE PARTIDAS DO JOGADOR
// ════════════════════════════════════════════════════════════
function _normalizeTournamentMatch(m, youId, byId, meta) {
  const youAreA = m.a === youId;
  const oppId = youAreA ? m.b : m.a;
  const myGoals = youAreA ? m.ga : m.gb;
  const oppGoals = youAreA ? m.gb : m.ga;
  const myEvents = (youAreA ? m.eventsA : m.eventsB) || [];
  const oppEvents = (youAreA ? m.eventsB : m.eventsA) || [];
  let pens = null;
  if (m.pens && m.pens.kicks) {
    pens = {
      kicks: m.pens.kicks,
      myScore: youAreA ? m.pens.a : m.pens.b,
      oppScore: youAreA ? m.pens.b : m.pens.a,
      youWon: m.winner === youId,
    };
  }
  const me = byId[youId] || { name: 'Você', flag: '🎮' };
  const opp = byId[oppId] || { name: 'Adversário', flag: '🏳️' };
  return Object.assign({
    oppId, youAreA, myGoals, oppGoals, myEvents, oppEvents, pens,
    meName: me.name, meFlag: me.flag || '🎮',
    oppName: opp.name, oppFlag: opp.flag || '🏳️',
    result: myGoals > oppGoals ? 'win' : (myGoals < oppGoals ? 'loss' : 'draw'),
    myTeam: me.teamPlayers || null,
    oppTeam: opp.teamPlayers || null,
    myStats: me.stats || null,
    oppStats: opp.stats || null,
    myTactic: me.tactic || null,
    oppTactic: opp.tactic || null,
    myCaptainId: me.captainId || null,
    oppCaptainId: opp.captainId || null,
    mySlots: me.slots || [],
    oppSlots: opp.slots || [],
    myFormation: me.formation || null,
    oppFormation: opp.formation || null,
  }, meta);
}

// Caminho do jogador: 3 jogos de grupo + mata-mata até cair/ser campeão.
function buildMatchQueue(data, youId) {
  const byId = tournamentById(data);
  const out = [];

  // Grupo do jogador
  let myGroup = null;
  for (const g of data.groups) {
    if (g.table.find(r => r.pid === youId)) { myGroup = g; break; }
  }
  if (myGroup) {
    const myMatches = myGroup.matches.filter(m => m.a === youId || m.b === youId);
    myMatches.forEach((m, i) => {
      out.push(_normalizeTournamentMatch(m, youId, byId, {
        phaseId: 'group',
        phaseLabel: `Grupo ${myGroup.name} — Jogo ${i + 1}`,
        isLastGroup: i === myMatches.length - 1,
      }));
    });
    const row = myGroup.table.find(r => r.pid === youId);
    if (!row || row.rank > 2) return out; // eliminado na fase de grupos
  }

  // Mata-mata do jogador
  for (let ri = 0; ri < data.knockout.rounds.length; ri++) {
    const round = data.knockout.rounds[ri];
    const m = round.matches.find(x => x.a === youId || x.b === youId);
    if (!m) continue;
    out.push(_normalizeTournamentMatch(m, youId, byId, {
      phaseId: round.id, phaseLabel: round.label, roundIdx: ri,
    }));
    if (m.winner !== youId) break; // eliminado
  }
  return out;
}

// Survival: cada fase não-pulada vira uma "partida".
function buildSurvivalQueue(simResult) {
  // Captura o time do jogador no momento da chamada (disponível via state global).
  const myPlayers = (typeof state !== 'undefined' && state.slots)
    ? state.slots.map(s => s.player).filter(Boolean).map(p => ({
        id: p.id, name: p.name, position: p.position, overall: p.overall, flag: p.flag,
      }))
    : null;
  const myStats = (typeof state !== 'undefined' && state.simResults)
    ? (state.simResults.stats || null)
    : null;
  const myTactic = (typeof state !== 'undefined') ? state.tactic : null;

  return simResult.results.filter(r => r.status !== 'skipped').map(r => ({
    phaseId: r.id, phaseLabel: r.label,
    myGoals: r.goalsFor, oppGoals: r.goalsAgainst,
    myEvents: r.eventsFor || [], oppEvents: r.eventsAgainst || [],
    pens: null,
    meName: 'Seu time', meFlag: '🎮',
    oppName: 'Adversário', oppFlag: '🏳️',
    result: r.goalsFor > r.goalsAgainst ? 'win' : (r.goalsFor < r.goalsAgainst ? 'loss' : 'draw'),
    myTeam: myPlayers,
    oppTeam: null,
    myStats: myStats,
    oppStats: r.strength != null ? { overall: r.strength } : null,
    myTactic: myTactic,
    oppTactic: null,
    myCaptainId: (typeof state !== 'undefined') ? state.captainId : null,
    oppCaptainId: null,
    mySlots: (typeof state !== 'undefined' && state.slots) ? state.slots.map(s => s.pos) : [],
    oppSlots: [],
    myFormation: (typeof state !== 'undefined') ? state.formation : null,
    oppFormation: null,
  }));
}

// ── Campo visual de escalação (posicionamento absoluto = draft) ────────────

// Calcula [y%, x%] para um array de slots sem formation nomeada (bots).
// Agrupa por zona e espalha horizontalmente respeitando lado (L/C/R) de cada posição.
function _computeFieldPos(slots) {
  const ZONE_Y = { GK: 90, DEF: 74, CDM: 58, MID: 47, CAM: 34, ATT: 18 };
  const SLOT_ZONE = {
    GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
    CDM: 'CDM', CM: 'MID', LM: 'MID', RM: 'MID', CAM: 'CAM',
    LW: 'ATT', RW: 'ATT', ST: 'ATT',
  };
  // 0=esquerda, 1=centro, 2=direita
  const LR = { LB: 0, LWB: 0, LM: 0, LW: 0, CB: 1, CDM: 1, CM: 1, CAM: 1, GK: 1, ST: 1, RB: 2, RWB: 2, RM: 2, RW: 2 };

  const byZone = {};
  slots.forEach((pos, i) => {
    const z = SLOT_ZONE[pos] || 'MID';
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push({ i, pos, lr: LR[pos] ?? 1 });
  });
  Object.values(byZone).forEach(g => g.sort((a, b) => a.lr - b.lr));

  const result = new Array(slots.length).fill(null);
  Object.entries(byZone).forEach(([zone, group]) => {
    const y = ZONE_Y[zone] || 50;
    const n = group.length;
    const spread = Math.min(80, (n - 1) * 26);
    const x0 = 50 - spread / 2;
    group.forEach(({ i }, idx) => {
      const x = n === 1 ? 50 : Math.round(x0 + (idx / (n - 1)) * spread);
      result[i] = [y, x];
    });
  });
  return result;
}

function renderMatchField(players, tactic, stats, captainId, slots, formation) {
  if (!players || !players.length) return '<div class="mf-empty">—</div>';

  // Coordenadas: formação exata (FIELD_POSITIONS) ou computed (bots)
  let fieldPos = null;
  if (formation && typeof FIELD_POSITIONS !== 'undefined' && FIELD_POSITIONS[formation]) {
    fieldPos = FIELD_POSITIONS[formation];
  } else if (slots && slots.length >= players.length) {
    fieldPos = _computeFieldPos(slots);
  }

  const tacticInfo = (typeof TACTICS !== 'undefined' && tactic) ? TACTICS[tactic] : null;
  const ovr = stats ? stats.overall : null;

  let html = '<div class="mf-root">';

  // Cabeçalho: tática + OVR
  if (tacticInfo || ovr != null) {
    html += '<div class="mf-header">';
    if (tacticInfo) html += `<span class="mf-tactic">${tacticInfo.emoji} ${tacticInfo.label}</span>`;
    if (ovr != null) html += `<span class="mf-ovr-badge">OVR ${ovr}</span>`;
    html += '</div>';
  }

  // Campo com posicionamento absoluto — mesmo visual do draft
  html += '<div class="mf-field-abs">';
  players.forEach((p, i) => {
    const [y, x] = (fieldPos && fieldPos[i]) ? fieldPos[i] : [50, 50];
    const isCpt = captainId && p.id === captainId;
    const card = (typeof renderPlayerCard === 'function')
      ? renderPlayerCard(p, { size: 'mini', mode: 'classic', captain: isCpt })
      : `<div class="mf-fallback">${p.overall}</div>`;
    html += `<div class="field-slot" style="left:${x}%;top:${y}%">${card}</div>`;
  });
  html += '</div></div>'; // mf-field-abs + mf-root
  return html;
}

// ════════════════════════════════════════════════════════════
//  SCOREBOARD (placar ao vivo)
// ════════════════════════════════════════════════════════════
function scoreboardMarkup() {
  return `
  <div class="scoreboard">
    <div class="sb-phase" id="sb-phase"></div>
    <div class="sb-main">
      <div class="sb-team me">
        <div class="sb-flag" id="sb-me-flag"></div>
        <div class="sb-tname" id="sb-me-name"></div>
      </div>
      <div class="sb-center">
        <div class="sb-score"><span id="sb-sa">0</span><span class="sb-dash">—</span><span id="sb-sb">0</span></div>
        <div class="sb-clock" id="sb-clock">0'</div>
      </div>
      <div class="sb-team opp">
        <div class="sb-flag" id="sb-opp-flag"></div>
        <div class="sb-tname" id="sb-opp-name"></div>
      </div>
    </div>
    <div class="sb-progress"><div class="sb-progress-fill" id="sb-prog"></div></div>
    <div class="sb-feed" id="sb-feed"></div>
    <div class="sb-pens hidden" id="sb-pens">
      <div class="sb-pens-title" id="sb-pens-title"></div>
      <div class="sb-pens-list" id="sb-pens-list"></div>
    </div>
    <div class="sb-controls">
      <div class="sb-speed-group">
        <button class="sb-speed" data-speed="slow" title="Lento">🐢</button>
        <button class="sb-speed" data-speed="normal" title="Normal">▶</button>
        <button class="sb-speed" data-speed="fast" title="Rápido">⚡</button>
      </div>
      <button class="sb-auto" id="sb-auto">⏯ Auto</button>
      <button class="sb-btn" id="sb-skip">⏭ Pular</button>
      <button class="sb-btn ghost" id="sb-skipall">⏏ Pular tudo</button>
      <button class="sb-next hidden" id="sb-next">Próxima ▶</button>
    </div>
    <details class="sb-lineups-wrap" open>
      <summary class="sb-lineups-toggle">⚽ Escalações</summary>
      <div class="sb-lineups">
        <div class="sb-lineup-col me">
          <div class="sb-lineup-title" id="sb-lineup-me-title"></div>
          <div class="sb-lineup-players" id="sb-lineup-me"></div>
        </div>
        <div class="sb-lineup-col opp">
          <div class="sb-lineup-title" id="sb-lineup-opp-title"></div>
          <div class="sb-lineup-players" id="sb-lineup-opp"></div>
        </div>
      </div>
    </details>
  </div>`;
}

function mountScoreboard(containerId) {
  ['match-stage', 'match-stage-sim'].forEach(id => {
    const c = document.getElementById(id); if (c) c.innerHTML = '';
  });
  const host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = scoreboardMarkup();
  const root = host.querySelector('.scoreboard');
  _pb.sb = {
    root,
    phase: root.querySelector('#sb-phase'),
    meFlag: root.querySelector('#sb-me-flag'), meName: root.querySelector('#sb-me-name'),
    oppFlag: root.querySelector('#sb-opp-flag'), oppName: root.querySelector('#sb-opp-name'),
    sa: root.querySelector('#sb-sa'), sbg: root.querySelector('#sb-sb'),
    clock: root.querySelector('#sb-clock'), prog: root.querySelector('#sb-prog'),
    feed: root.querySelector('#sb-feed'),
    pens: root.querySelector('#sb-pens'),
    pensTitle: root.querySelector('#sb-pens-title'),
    pensList: root.querySelector('#sb-pens-list'),
    next: root.querySelector('#sb-next'),
  };
  wireScoreboard(root);
  syncControls(root);
}

function hideScoreboard(containerId) {
  const c = document.getElementById(containerId); if (c) c.innerHTML = '';
  if (_pb) _pb.sb = null;
}

function wireScoreboard(root) {
  root.addEventListener('click', (e) => {
    if (_pb && _pb.multiplayer) {
      if (e.target.closest('#sb-next')) { if (_pb && _pb.resolveNext) _pb.resolveNext(); }
      return;
    }
    const spd = e.target.closest('[data-speed]');
    if (spd) { setSpeed(spd.dataset.speed); return; }
    if (e.target.closest('#sb-auto')) { toggleAuto(); return; }
    if (e.target.closest('#sb-skip')) { skipCurrentMatch(); return; }
    if (e.target.closest('#sb-skipall')) { skipAll(); return; }
    if (e.target.closest('#sb-next')) { if (_pb && _pb.resolveNext) _pb.resolveNext(); return; }
  });
}

function syncControls(root) {
  root.querySelectorAll('[data-speed]').forEach(b =>
    b.classList.toggle('active', b.dataset.speed === playbackPrefs.speed));
  const auto = root.querySelector('#sb-auto');
  if (auto) {
    auto.classList.toggle('on', playbackPrefs.auto);
    auto.textContent = playbackPrefs.auto ? '⏯ Auto' : '✋ Manual';
  }
}

// ── Atualizações pontuais do scoreboard ───────────────────────
function _sb() { return _pb && _pb.sb; }
function setScore(a, b) { const s = _sb(); if (s) { s.sa.textContent = a; s.sbg.textContent = b; } }
function setClock(min) { const s = _sb(); if (s) s.clock.textContent = min + "'"; }
function setProgress(f) { const s = _sb(); if (s) s.prog.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }
function setPhaseLabel(t) { const s = _sb(); if (s) s.phase.textContent = t; }
function setTeams(m) {
  const s = _sb(); if (!s) return;
  s.meFlag.textContent = m.meFlag; s.meName.textContent = m.meName;
  s.oppFlag.textContent = m.oppFlag; s.oppName.textContent = m.oppName;

  // Painel de escalação
  const meTitle = s.root.querySelector('#sb-lineup-me-title');
  const oppTitle = s.root.querySelector('#sb-lineup-opp-title');
  const meList = s.root.querySelector('#sb-lineup-me');
  const oppList = s.root.querySelector('#sb-lineup-opp');
  if (meTitle) meTitle.textContent = `${m.meFlag} ${m.meName}`;
  if (oppTitle) oppTitle.textContent = `${m.oppFlag} ${m.oppName}`;
  if (meList) meList.innerHTML = renderMatchField(m.myTeam, m.myTactic, m.myStats, m.myCaptainId, m.mySlots, m.myFormation);
  if (oppList) oppList.innerHTML = renderMatchField(m.oppTeam, m.oppTactic, m.oppStats, m.oppCaptainId, m.oppSlots, m.oppFormation);
}
function clearFeed() { const s = _sb(); if (s) s.feed.innerHTML = ''; }
function addGoalToFeed(ev, m) {
  const s = _sb(); if (!s) return;
  const who = ev.name || (ev.mine ? m.meName : m.oppName);
  const row = document.createElement('div');
  row.className = 'sb-goal ' + (ev.mine ? 'mine' : 'opp');
  row.innerHTML = `<span class="sb-goal-min">${ev.minute}'</span> ⚽ <span class="sb-goal-who">${escapeHtml(who)}</span>`;
  s.feed.appendChild(row);
  s.feed.scrollTop = s.feed.scrollHeight;
}
function showPensArea() {
  const s = _sb(); if (!s) return;
  s.pens.classList.remove('hidden');
  s.pensList.innerHTML = '';
  s.pensTitle.textContent = 'Disputa de pênaltis';
}
function hidePensArea() { const s = _sb(); if (s) s.pens.classList.add('hidden'); }
function addPenToFeed(k, mine, tally) {
  const s = _sb(); if (!s) return;
  const icon = k.result === 'goal' ? '⚽' : (k.result === 'save' ? '🧤' : '❌');
  const row = document.createElement('div');
  row.className = 'sb-pk ' + (mine ? 'mine' : 'opp') + (k.scored ? ' goal' : ' miss');
  row.innerHTML = `<span class="sb-pk-icon">${icon}</span>` +
    `<span class="sb-pk-who">${escapeHtml(k.kicker.name)}</span>` +
    `<span class="sb-pk-tally">${tally}</span>`;
  s.pensList.appendChild(row);
}
function showPensResult(m) {
  const s = _sb(); if (!s) return;
  s.pensTitle.textContent = `Pênaltis ${m.pens.myScore}-${m.pens.oppScore} — ${m.pens.youWon ? 'você venceu!' : 'você perdeu'}`;
}
function showNextBtn(show) { const s = _sb(); if (s && s.next) s.next.classList.toggle('hidden', !show); }

// ── Controles (refletem ao vivo) ──────────────────────────────
function setSpeed(s) {
  if (!SPEED_DURATIONS[s]) return;
  playbackPrefs.speed = s; savePlaybackPrefs();
  if (_sb()) syncControls(_sb().root);
  if (_pb && _pb.restartTimer) _pb.restartTimer(); // muda o ritmo na hora
}
function toggleAuto() {
  playbackPrefs.auto = !playbackPrefs.auto; savePlaybackPrefs();
  if (_sb()) syncControls(_sb().root);
  if (_pb && _pb.applyWaitMode) _pb.applyWaitMode(); // reavalia se está aguardando
}
function skipCurrentMatch() {
  if (!_pb || _pb.aborted) return;
  _pb.skipMatch = true;
  if (_pb.doSkipMatch) _pb.doSkipMatch();
}
function skipAll() {
  if (!_pb || _pb.aborted) return;
  _pb.aborted = true;
  if (_pb.stopClock) _pb.stopClock();
  clearTimeout(_pb.nextTimer); clearTimeout(_pb.sleepTimer); clearTimeout(_pb.penTimer);
  if (_pb.resolveMatch) { const r = _pb.resolveMatch; _pb.resolveMatch = null; r(); }
  if (_pb.resolveNext) { const r = _pb.resolveNext; _pb.resolveNext = null; r(); }
  if (_pb.sleepResolve) { const r = _pb.sleepResolve; _pb.sleepResolve = null; r(); }
}

// ════════════════════════════════════════════════════════════
//  PLAYBACK DE UMA PARTIDA (relógio 1'→90' + gols + pênaltis)
// ════════════════════════════════════════════════════════════
function playOneMatch(m) {
  return new Promise(resolve => {
    _pb.resolveMatch = resolve;
    _pb.skipMatch = false;

    setPhaseLabel(m.phaseLabel);
    setTeams(m);
    setScore(0, 0);
    setClock(0);
    setProgress(0);
    clearFeed();
    hidePensArea();
    showNextBtn(false);

    // Gols ordenados por minuto (meus + do adversário)
    const events = [];
    (m.myEvents || []).forEach(e => events.push({ minute: e.minute, mine: true, name: e.scorer ? e.scorer.name : null }));
    (m.oppEvents || []).forEach(e => events.push({ minute: e.minute, mine: false, name: e.scorer ? e.scorer.name : null }));
    events.sort((a, b) => a.minute - b.minute);

    let minute = 0, sa = 0, sb = 0, ei = 0, finished = false, timer = null;

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    _pb.stopClock = stop;

    function applyEventsUpTo(min) {
      while (ei < events.length && events[ei].minute <= min) {
        const ev = events[ei++];
        if (ev.mine) sa++; else sb++;
        setScore(sa, sb);
        addGoalToFeed(ev, m);
      }
    }

    function finishMatch() {
      if (finished) return;
      finished = true;
      stop();
      minute = 90; setClock(90); setProgress(1);
      applyEventsUpTo(90);
      setScore(m.myGoals, m.oppGoals); // segurança contra arredondamento
      if (m.pens && m.pens.kicks && m.pens.kicks.length) {
        playShootout(m).then(() => { _pb.resolveMatch = null; resolve(); });
      } else {
        _pb.resolveMatch = null; resolve();
      }
    }
    _pb.doSkipMatch = finishMatch;

    function tick() {
      minute++;
      setClock(minute);
      setProgress(minute / 90);
      applyEventsUpTo(minute);
      if (minute >= 90) finishMatch();
    }
    function startTimer() {
      stop();
      const dur = (_pb && _pb.multiplayer) ? SPEED_DURATIONS.normal : (SPEED_DURATIONS[playbackPrefs.speed] || 9000);
      timer = setInterval(tick, Math.max(16, dur / 90));
    }
    _pb.restartTimer = startTimer; // chamado ao trocar a velocidade
    startTimer();
  });
}

function playShootout(m) {
  return new Promise(resolve => {
    showPensArea();
    const kicks = m.pens.kicks;
    let i = 0;
    function step() {
      if (_pb.aborted) { showPensResult(m); resolve(); return; }
      if (i >= kicks.length) { showPensResult(m); resolve(); return; }
      const k = kicks[i++];
      const mine = (k.team === 'a') === m.youAreA;
      const tally = m.youAreA ? `${k.sa}-${k.sb}` : `${k.sb}-${k.sa}`;
      addPenToFeed(k, mine, tally);
      const delay = _pb.skipMatch ? 0 : Math.max(120, 650 * speedFactor());
      _pb.penTimer = setTimeout(step, delay);
    }
    step();
  });
}

// Pausa entre partidas — reavaliável ao vivo (auto vs manual).
function waitForNext() {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(_pb.nextTimer);
      _pb.applyWaitMode = null; _pb.resolveNext = null;
      showNextBtn(false);
      resolve();
    };
    _pb.resolveNext = finish;
    _pb.applyWaitMode = function () {
      clearTimeout(_pb.nextTimer);
      if (playbackPrefs.auto || (_pb && _pb.multiplayer)) {
        showNextBtn(false);
        _pb.nextTimer = setTimeout(finish, 1300);
      } else {
        showNextBtn(true);
      }
    };
    _pb.applyWaitMode();
  });
}

function sleep(ms) {
  return new Promise(r => {
    _pb.sleepResolve = r;
    _pb.sleepTimer = setTimeout(() => { _pb.sleepResolve = null; r(); }, ms);
  });
}

// ════════════════════════════════════════════════════════════
//  ORQUESTRADOR
// ════════════════════════════════════════════════════════════
async function playMatchSequence(data, youId, opts) {
  opts = opts || {};
  const onComplete = opts.onComplete || function () {};
  const survival = !!opts.survival;
  const D = survival ? data : Object.assign({}, data, { youId });

  _pb = { aborted: false, skipMatch: false, multiplayer: !!opts.multiplayer };

  if (survival) {
    const stages = document.getElementById('sim-stages'); if (stages) stages.style.display = 'none';
    mountScoreboard('match-stage-sim');
  } else {
    ['bracket-champion', 'bracket-yourpath', 'groups-wrap', 'knockout-wrap'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    mountScoreboard('match-stage');
  }

  if (_pb.multiplayer && _pb.sb) {
    ['.sb-speed-group', '#sb-auto', '#sb-skip', '#sb-skipall'].forEach(sel => {
      const el = _pb.sb.root.querySelector(sel); if (el) el.style.display = 'none';
    });
  }

  const queue = survival ? buildSurvivalQueue(D) : buildMatchQueue(D, youId);

  if (!survival && queue.length === 0) { // segurança
    renderTournamentResult(D); hideScoreboard('match-stage'); onComplete(); return;
  }

  let groupRevealed = false;
  const revealedRounds = new Set();

  for (let qi = 0; qi < queue.length && !_pb.aborted; qi++) {
    const m = queue[qi];
    await playOneMatch(m);
    if (_pb.aborted) break;

    // Revelação progressiva dos outros confrontos (somente torneio)
    if (!survival) {
      if (m.phaseId === 'group' && m.isLastGroup && !groupRevealed) {
        renderGroupsSection(D); groupRevealed = true;
      } else if (m.phaseId !== 'group' && m.roundIdx != null && !revealedRounds.has(m.roundIdx)) {
        const ko = document.getElementById('knockout-wrap');
        if (ko) ko.insertAdjacentHTML('beforeend', renderKnockoutRound(D.knockout.rounds[m.roundIdx], D));
        revealedRounds.add(m.roundIdx);
      }
    }

    if (qi < queue.length - 1 && !_pb.aborted) await waitForNext();
  }

  if (survival) {
    hideScoreboard('match-stage-sim');
    const stages = document.getElementById('sim-stages'); if (stages) stages.style.display = '';
    onComplete();
    return;
  }

  // Fim do torneio: revela o que faltou + campeão
  if (_pb.aborted) {
    renderTournamentResult(D); // pular tudo: tudo de uma vez
  } else {
    if (!groupRevealed) renderGroupsSection(D);
    await revealRemainingRounds(D, revealedRounds);
    renderChampionAndPath(D);
  }
  hideScoreboard('match-stage');
  onComplete();
}

// Revela rodadas ainda não mostradas (jogador eliminado antes do fim), até o campeão.
async function revealRemainingRounds(D, revealedRounds) {
  const ko = document.getElementById('knockout-wrap');
  for (let ri = 0; ri < D.knockout.rounds.length; ri++) {
    if (revealedRounds.has(ri)) continue;
    if (ko) ko.insertAdjacentHTML('beforeend', renderKnockoutRound(D.knockout.rounds[ri], D));
    revealedRounds.add(ri);
    if (!_pb.aborted) await sleep(650);
  }
}
