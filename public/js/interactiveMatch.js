/* ============================================================
   7a0 — Partida Interativa (modo Eventos / "pedra-papel-tesoura")
   Roda UMA partida do JOGADOR ao vivo: relógio 1'→90', lances de
   decisão (modal: 3 ações), gols de fundo (Poisson), stamina/momentum/
   vermelho, e pênaltis interativos (L/M/R). Reusa o motor puro events.js.

   Depende de globais já carregados:
   - events.js: window.Events (motor puro de eventos)
   - engine.js: mulberry32, generateSeed
   - match.js:  renderMatchField (escalação visual)
   - ui.js:     escapeHtml, showToast
   - game.js:   TACTICS/posLabel (via window)

   Expõe: playInteractiveMatch(pa, pb, opts) → Promise<matchResult>.
   matchResult tem o mesmo formato de Tournament.playMatch:
     { a, b, ga, gb, eventsA, eventsB, winner?, pens? }
   ============================================================ */

let _im = null; // estado da partida interativa corrente

function imSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Modal de decisão (overlay) ────────────────────────────────
function imEnsureModal() {
  let backdrop = document.getElementById('im-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'im-modal-backdrop';
    backdrop.className = 'im-modal-backdrop hidden';
    backdrop.innerHTML = `<div class="im-modal" id="im-modal"></div>`;
    document.body.appendChild(backdrop);
  }
  return document.getElementById('im-modal');
}
function imShowModal(html) {
  imClearTimer(); // qualquer modal novo cancela a contagem regressiva anterior
  const modal = imEnsureModal();
  modal.innerHTML = html;
  document.getElementById('im-modal-backdrop').classList.remove('hidden');
  return modal;
}
function imHideModal() {
  imClearTimer();
  const b = document.getElementById('im-modal-backdrop');
  if (b) b.classList.add('hidden');
}

// ── Barra de contagem regressiva (prazo da escolha no multiplayer) ──
let _imCountdown = null; // { raf } da animação atual
function imClearTimer() {
  if (_imCountdown) { cancelAnimationFrame(_imCountdown.raf); _imCountdown = null; }
}
// Anima #im-timer-fill de 100%→0% em totalMs, com cor verde→amarelo→vermelho.
function imStartTimer(totalMs) {
  const fill = document.getElementById('im-timer-fill');
  if (!fill || !totalMs) return;
  const start = performance.now();
  const tick = (now) => {
    const frac = Math.max(0, 1 - (now - start) / totalMs);
    fill.style.width = (frac * 100) + '%';
    fill.style.background = `hsl(${Math.round(frac * 120)}, 80%, 48%)`; // 120=verde → 0=vermelho
    if (frac <= 0) {
      _imCountdown = null;
      const lbl = document.getElementById('im-timer-lbl');
      if (lbl) lbl.textContent = '⏱ Tempo esgotado — escolha automática';
      return;
    }
    _imCountdown = { raf: requestAnimationFrame(tick) };
  };
  _imCountdown = { raf: requestAnimationFrame(tick) };
}
// Markup da barra (vazio em modo solo, onde não há prazo).
function imTimerBar(timeout) {
  if (!timeout) return '';
  return `<div class="im-timer"><div class="im-timer-fill" id="im-timer-fill"></div></div>
          <div class="im-timer-lbl" id="im-timer-lbl">⏱ Escolha em até ${Math.round(timeout / 1000)}s</div>`;
}

// Pergunta uma ação ao humano (atacante ou defensor). Resolve com a key escolhida.
function imAskAction(role, minute, ms, timeout) {
  return new Promise(resolve => {
    const isAtk = role === 'attacker';
    const actions = isAtk ? Events.ATK_ACTIONS : Events.DEF_ACTIONS;
    const roleLabel = isAtk
      ? '<span class="im-role atk">⚔️ Você ATACA</span>'
      : '<span class="im-role def">🛡️ Você DEFENDE</span>';
    const tip = isAtk ? 'Escolha como criar a chance' : 'Escolha como travar o ataque';
    const buttons = Object.values(actions).map(a => `
      <button class="im-action" data-key="${a.key}">
        <span class="im-action-emoji">${a.emoji}</span>
        <span class="im-action-label">${a.label}</span>
        <span class="im-action-desc">${a.desc}</span>
        <span class="im-action-cost">🔋 ${a.staminaCost}</span>
      </button>`).join('');
    const modal = imShowModal(`
      <div class="im-head">
        <div class="im-minute">${minute}'</div>
        ${roleLabel}
        <div class="im-secret">🔒 Escolha secreta</div>
      </div>
      <p class="im-tip">${tip}</p>
      ${imTimerBar(timeout)}
      <div class="im-actions-grid">${buttons}</div>
    `);
    modal.querySelectorAll('.im-action').forEach(btn => {
      btn.addEventListener('click', () => { imClearTimer(); resolve(btn.dataset.key); }, { once: true });
    });
    imStartTimer(timeout);
  });
}

// Mostra o resultado de um lance (escolhas reveladas + desfecho). Resolve após confirmar.
// opts.auto (ms): se definido, dispensa automaticamente (usado no multiplayer).
function imShowEventReveal(d, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const atkA = Events.ATK_ACTIONS[d.atkKey], defA = Events.DEF_ACTIONS[d.defKey];
    const r = d.result;
    const outClass = r.outcome === 'goal' ? 'goal' : (r.outcome === 'save' ? 'save' : 'neutral');
    const outText = r.outcome === 'goal' ? '⚽ GOL!' : (r.outcome === 'save' ? '🧤 DEFENDEU!' : '↩️ Lance perdido');
    // Quem foi o atacante/defensor humano?
    const myAtk = d.humanIsAtk;
    const notes = [];
    if (r.redCard) notes.push(`<div class="im-note red">🟥 Cartão vermelho! ${r.redCard.side === d.humanSide ? 'Seu time' : 'Adversário'} com um a menos.</div>`);
    if (r.momentumGranted) notes.push(`<div class="im-note mom">🔥 Momentum! ${r.momentumGranted.side === d.humanSide ? 'Seu time' : 'Adversário'} embalado (+5% por 15').</div>`);
    imShowModal(`
      <div class="im-reveal ${outClass}">
        <div class="im-reveal-picks">
          <div class="im-pick ${myAtk ? 'mine' : 'opp'}">
            <div class="im-pick-side">${myAtk ? 'Você (ataque)' : 'Adversário (ataque)'}</div>
            <div class="im-pick-act">${atkA.emoji} ${atkA.label}</div>
          </div>
          <div class="im-vs">VS</div>
          <div class="im-pick ${myAtk ? 'opp' : 'mine'}">
            <div class="im-pick-side">${myAtk ? 'Adversário (defesa)' : 'Você (defesa)'}</div>
            <div class="im-pick-act">${defA.emoji} ${defA.label}</div>
          </div>
        </div>
        <div class="im-outcome ${outClass}">${outText}</div>
        <div class="im-prob">Chance de gol: ${Math.round(r.pGoal * 100)}%${r.scorer ? ` · ${escapeHtml(r.scorer.name)}` : ''}</div>
        ${notes.join('')}
        ${opts.auto ? '<div class="im-autonote">Próximo lance em instantes…</div>' : '<button class="btn btn-primary im-continue">Continuar ▶</button>'}
      </div>
    `);
    if (opts.auto) {
      setTimeout(() => { imHideModal(); resolve(); }, opts.auto);
    } else {
      document.querySelector('.im-continue').addEventListener('click', () => resolve(), { once: true });
    }
  });
}

// Pergunta uma direção (esquerda/meio/direita) ao humano. prompt = texto.
function imAskDirection(promptText, tally, timeout) {
  return new Promise(resolve => {
    const dirs = [
      { key: 'esquerda', label: 'Esquerda', icon: '◀' },
      { key: 'meio', label: 'Meio', icon: '⬆' },
      { key: 'direita', label: 'Direita', icon: '▶' },
    ];
    const buttons = dirs.map(dz => `
      <button class="im-dir" data-dir="${dz.key}">
        <span class="im-dir-icon">${dz.icon}</span>
        <span class="im-dir-label">${dz.label}</span>
      </button>`).join('');
    imShowModal(`
      <div class="im-head pens">
        <div class="im-pens-title">🥅 Pênaltis</div>
        <div class="im-pens-tally">${tally}</div>
      </div>
      <p class="im-tip">${promptText}</p>
      ${imTimerBar(timeout)}
      <div class="im-dir-grid">${buttons}</div>
    `);
    document.querySelectorAll('.im-dir').forEach(btn => {
      btn.addEventListener('click', () => { imClearTimer(); resolve(btn.dataset.dir); }, { once: true });
    });
    imStartTimer(timeout);
  });
}

function imShowPenReveal(d, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const cls = d.scored ? 'goal' : (d.result === 'save' ? 'save' : 'miss');
    const txt = d.scored ? '⚽ GOL!' : (d.result === 'save' ? '🧤 DEFENDEU!' : '❌ PRA FORA!');
    const dirLabel = { esquerda: 'Esquerda', meio: 'Meio', direita: 'Direita' };
    imShowModal(`
      <div class="im-reveal ${cls}">
        <div class="im-pen-kicker">${escapeHtml(d.kickerName)} ${d.humanKicked ? '(você bateu)' : ''}</div>
        <div class="im-reveal-picks">
          <div class="im-pick"><div class="im-pick-side">Chute</div><div class="im-pick-act">${dirLabel[d.kickDir]}</div></div>
          <div class="im-vs">VS</div>
          <div class="im-pick"><div class="im-pick-side">Goleiro</div><div class="im-pick-act">${dirLabel[d.diveDir]}</div></div>
        </div>
        <div class="im-outcome ${cls}">${txt}</div>
        <div class="im-prob">${d.tally}</div>
        ${opts.auto ? '<div class="im-autonote">Próxima cobrança…</div>' : '<button class="btn btn-primary im-continue">Continuar ▶</button>'}
      </div>
    `);
    if (opts.auto) {
      setTimeout(() => { imHideModal(); resolve(); }, opts.auto);
    } else {
      document.querySelector('.im-continue').addEventListener('click', () => resolve(), { once: true });
    }
  });
}

// ════════════════════════════════════════════════════════════
//  PLACAR / BOARD AO VIVO
// ════════════════════════════════════════════════════════════
function imBoardMarkup(m) {
  return `
  <div class="iboard">
    <div class="ib-phase">${escapeHtml(m.phaseLabel || '')}</div>
    <div class="ib-main">
      <div class="ib-team me">
        <div class="ib-flag">${m.meFlag}</div><div class="ib-name">${escapeHtml(m.meName)}</div>
      </div>
      <div class="ib-center">
        <div class="ib-score"><span id="ib-sme">0</span><span class="ib-dash">—</span><span id="ib-sopp">0</span></div>
        <div class="ib-clock" id="ib-clock">0'</div>
      </div>
      <div class="ib-team opp">
        <div class="ib-flag">${m.oppFlag}</div><div class="ib-name">${escapeHtml(m.oppName)}</div>
      </div>
    </div>
    <div class="ib-bars">
      <div class="ib-barside">
        <div class="ib-stamina"><div class="ib-stamina-fill me" id="ib-stam-me"></div></div>
        <div class="ib-badges" id="ib-badges-me"></div>
      </div>
      <div class="ib-barside opp">
        <div class="ib-stamina"><div class="ib-stamina-fill opp" id="ib-stam-opp"></div></div>
        <div class="ib-badges" id="ib-badges-opp"></div>
      </div>
    </div>
    <div class="ib-progress"><div class="ib-progress-fill" id="ib-prog"></div></div>
    <div class="ib-feed" id="ib-feed"></div>
    <details class="ib-lineups-wrap">
      <summary>⚽ Escalações</summary>
      <div class="ib-lineups">
        <div class="ib-lineup-col"><div class="ib-lineup-title">${m.meFlag} ${escapeHtml(m.meName)}</div><div id="ib-line-me"></div></div>
        <div class="ib-lineup-col"><div class="ib-lineup-title">${m.oppFlag} ${escapeHtml(m.oppName)}</div><div id="ib-line-opp"></div></div>
      </div>
    </details>
  </div>`;
}

function imMountBoard(containerId, m) {
  const host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = imBoardMarkup(m);
  _im.board = {
    sme: host.querySelector('#ib-sme'), sopp: host.querySelector('#ib-sopp'),
    clock: host.querySelector('#ib-clock'), prog: host.querySelector('#ib-prog'),
    feed: host.querySelector('#ib-feed'),
    stamMe: host.querySelector('#ib-stam-me'), stamOpp: host.querySelector('#ib-stam-opp'),
    badgesMe: host.querySelector('#ib-badges-me'), badgesOpp: host.querySelector('#ib-badges-opp'),
  };
  // Escalações (reusa renderMatchField do match.js)
  if (typeof renderMatchField === 'function') {
    const meLine = host.querySelector('#ib-line-me'), oppLine = host.querySelector('#ib-line-opp');
    if (meLine) meLine.innerHTML = renderMatchField(m.mePlayers, m.meTactic, m.meStats, m.meCaptainId, m.meSlots, m.meFormation);
    if (oppLine) oppLine.innerHTML = renderMatchField(m.oppPlayers, m.oppTactic, m.oppStats, m.oppCaptainId, m.oppSlots, m.oppFormation);
  }
}

function imUpdateScore(meScore, oppScore) {
  const b = _im.board; if (!b) return;
  b.sme.textContent = meScore; b.sopp.textContent = oppScore;
}
function imUpdateClock(min) { const b = _im.board; if (b) b.clock.textContent = min + "'"; }
function imUpdateProgress(f) { const b = _im.board; if (b) b.prog.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }
function imUpdateBars(ms, humanSide) {
  const b = _im.board; if (!b) return;
  const meStam = humanSide === 'a' ? ms.staminaA : ms.staminaB;
  const oppStam = humanSide === 'a' ? ms.staminaB : ms.staminaA;
  b.stamMe.style.width = Math.round(meStam) + '%';
  b.stamOpp.style.width = Math.round(oppStam) + '%';
  b.stamMe.classList.toggle('low', meStam < Events.STAMINA_LOW);
  b.stamOpp.classList.toggle('low', oppStam < Events.STAMINA_LOW);
  const badge = (side) => {
    const out = [];
    if (Events.momentumActive(ms, side)) out.push('<span class="ib-badge mom">🔥</span>');
    const red = side === 'a' ? ms.redA : ms.redB;
    for (let i = 0; i < red; i++) out.push('<span class="ib-badge red">🟥</span>');
    return out.join('');
  };
  b.badgesMe.innerHTML = badge(humanSide);
  b.badgesOpp.innerHTML = badge(humanSide === 'a' ? 'b' : 'a');
}
function imAddGoalFeed(mine, scorer, minute) {
  const b = _im.board; if (!b) return;
  const row = document.createElement('div');
  row.className = 'ib-goal ' + (mine ? 'mine' : 'opp');
  row.innerHTML = `<span class="ib-goal-min">${minute}'</span> ⚽ <span class="ib-goal-who">${escapeHtml(scorer ? scorer.name : '?')}</span>`;
  b.feed.appendChild(row);
  b.feed.scrollTop = b.feed.scrollHeight;
}

// ════════════════════════════════════════════════════════════
//  PARTIDA INTERATIVA COMPLETA
// ════════════════════════════════════════════════════════════
// pa, pb: participantes { id, name, flag, team:{players,slots,tactic,captainId,penaltyOrder,formation} }
// opts: { humanSide:'a'|'b', knockout, phaseLabel, eventCount, container }
async function playInteractiveMatch(pa, pb, opts) {
  opts = opts || {};
  const containerId = opts.container || 'match-stage';
  const humanSide = opts.humanSide || 'a';
  const oppSide = humanSide === 'a' ? 'b' : 'a';
  const seed = (typeof generateSeed === 'function') ? generateSeed() : (Date.now() >>> 0);
  const ms = Events.newMatchState(pa.team, pb.team, { eventCount: opts.eventCount || 5, seed });
  const rng = mulberry32((seed ^ 0xA5A5A5) >>> 0);

  _im = { ms, humanSide, board: null };

  // Meta de exibição (humano sempre à esquerda)
  const mePart = humanSide === 'a' ? pa : pb;
  const oppPart = humanSide === 'a' ? pb : pa;
  imMountBoard(containerId, {
    phaseLabel: opts.phaseLabel,
    meName: mePart.name, meFlag: mePart.flag || '🎮',
    oppName: oppPart.name, oppFlag: oppPart.flag || '🏳️',
    mePlayers: mePart.team.players, meTactic: mePart.team.tactic, meStats: mePart.stats, meCaptainId: mePart.team.captainId, meSlots: mePart.team.slots, meFormation: mePart.team.formation,
    oppPlayers: oppPart.team.players, oppTactic: oppPart.team.tactic, oppStats: oppPart.stats, oppCaptainId: oppPart.team.captainId, oppSlots: oppPart.team.slots, oppFormation: oppPart.team.formation,
  });
  imUpdateBars(ms, humanSide);

  const eventsA = [], eventsB = [];
  const recordGoal = (side, scorer, minute) => {
    (side === 'a' ? eventsA : eventsB).push({ scorer, minute });
    imAddGoalFeed(side === humanSide, scorer, minute);
  };
  const refreshScore = () => imUpdateScore(humanSide === 'a' ? ms.scoreA : ms.scoreB, humanSide === 'a' ? ms.scoreB : ms.scoreA);

  // Relógio 1'→90'
  while (ms.clock < 90) {
    const goals = Events.applyBackgroundMinute(ms, rng); // incrementa ms.clock
    imUpdateClock(ms.clock);
    imUpdateProgress(ms.clock / 90);
    for (const g of goals) recordGoal(g.side, g.scorer, g.minute);
    refreshScore();
    imUpdateBars(ms, humanSide);

    if (ms.eventMinutes.includes(ms.clock)) {
      await runEvent(ms, ms.clock, humanSide, oppSide, rng, recordGoal, refreshScore);
      imHideModal();
    } else {
      await imSleep(28);
    }
  }
  imUpdateClock(90);
  imUpdateProgress(1);

  // Resultado base
  const out = { a: pa.id, b: pb.id, ga: ms.scoreA, gb: ms.scoreB, eventsA, eventsB };

  if (opts.knockout) {
    if (ms.scoreA === ms.scoreB) {
      const pens = await runInteractivePens(pa, pb, humanSide, rng);
      out.pens = { a: pens.a, b: pens.b, kicks: pens.kicks, suddenDeath: pens.suddenDeath };
      out.winner = pens.winner === 'a' ? pa.id : pb.id;
    } else {
      out.winner = ms.scoreA > ms.scoreB ? pa.id : pb.id;
    }
  }
  imHideModal();
  return out;
}

// Um lance interativo (humano escolhe; bot responde; resolve e revela).
async function runEvent(ms, minute, humanSide, oppSide, rng, recordGoal, refreshScore) {
  const atkSide = Events.pickAttackingSide(ms, rng);
  const humanIsAtk = atkSide === humanSide;
  const role = humanIsAtk ? 'attacker' : 'defender';

  const humanKey = await imAskAction(role, minute, ms);
  const botRole = humanIsAtk ? 'defender' : 'attacker';
  const botKey = Events.botChooseAction(ms, botRole, oppSide, rng);

  const atkKey = humanIsAtk ? humanKey : botKey;
  const defKey = humanIsAtk ? botKey : humanKey;
  const result = Events.resolveEvent(ms, atkSide, atkKey, defKey, rng);

  if (result.outcome === 'goal') recordGoal(atkSide, result.scorer, minute);
  refreshScore();
  imUpdateBars(ms, humanSide);

  await imShowEventReveal({ atkKey, defKey, humanIsAtk, humanSide, result, minute });
}

// Disputa de pênaltis interativa (melhor de 5 + morte súbita).
async function runInteractivePens(pa, pb, humanSide, rng) {
  const orderA = Events.penaltyOrderFor(pa.team), orderB = Events.penaltyOrderFor(pb.team);
  const gkA = Events.findGoalkeeper(pa.team), gkB = Events.findGoalkeeper(pb.team);
  let sa = 0, sb = 0, ia = 0, ib = 0;
  const kicks = [];

  const tallyStr = () => {
    const me = humanSide === 'a' ? sa : sb, opp = humanSide === 'a' ? sb : sa;
    return `Você ${me} — ${opp} Adversário`;
  };

  async function kick(team) {
    const order = team === 'a' ? orderA : orderB;
    const idx = team === 'a' ? ia : ib;
    const kicker = order[idx % order.length];
    const keeper = team === 'a' ? gkB : gkA;
    const humanKicked = team === humanSide;

    let kickDir, diveDir;
    if (humanKicked) {
      kickDir = await imAskDirection(`Onde bater? — ${escapeHtml(kicker.name)}`, tallyStr());
      diveDir = Events.botChooseDirection(rng);
    } else {
      diveDir = await imAskDirection(`Onde defender? — adversário vai bater`, tallyStr());
      kickDir = Events.botChooseDirection(rng);
    }
    const res = Events.resolvePenaltyKick(kicker, keeper, kickDir, diveDir, rng);
    if (team === 'a') { ia++; if (res.goal) sa++; } else { ib++; if (res.goal) sb++; }
    kicks.push({
      team, round: team === 'a' ? ia : ib,
      kicker: { id: kicker.id, name: kicker.name, position: kicker.position },
      result: res.result, scored: res.goal, sa, sb, kickDir, diveDir,
    });
    await imShowPenReveal({
      kickerName: kicker.name, humanKicked, kickDir, diveDir,
      result: res.result, scored: res.goal, tally: tallyStr(),
    });
    imHideModal();
  }

  // Melhor de 5 com parada antecipada
  for (let i = 0; i < 10; i++) {
    const remA = 5 - ia, remB = 5 - ib;
    if (sa > sb + remB || sb > sa + remA) break;
    await kick(i % 2 === 0 ? 'a' : 'b');
  }
  // Morte súbita
  let guard = 0;
  while (sa === sb && guard++ < 50) { await kick('a'); await kick('b'); }

  return { a: sa, b: sb, kicks, suddenDeath: (ia > 5 || ib > 5), winner: sa > sb ? 'a' : 'b' };
}

// ════════════════════════════════════════════════════════════
//  CAMADA MULTIPLAYER (servidor autoritativo — só renderiza/captura)
// ════════════════════════════════════════════════════════════
// O servidor (matchServer.js) roda a lógica; o cliente só monta o board,
// atualiza pelo relógio do servidor, captura escolhas e mostra reveals.

function imMpBars(staMe, staOpp, momMe, momOpp, redMe, redOpp) {
  const b = _im && _im.board; if (!b) return;
  b.stamMe.style.width = Math.round(staMe) + '%';
  b.stamOpp.style.width = Math.round(staOpp) + '%';
  b.stamMe.classList.toggle('low', staMe < Events.STAMINA_LOW);
  b.stamOpp.classList.toggle('low', staOpp < Events.STAMINA_LOW);
  const badge = (mom, red) => {
    const o = []; if (mom) o.push('<span class="ib-badge mom">🔥</span>');
    for (let i = 0; i < red; i++) o.push('<span class="ib-badge red">🟥</span>');
    return o.join('');
  };
  b.badgesMe.innerHTML = badge(momMe, redMe);
  b.badgesOpp.innerHTML = badge(momOpp, redOpp);
}

// match_start do servidor → monta o board (humano sempre à esquerda).
function imMpStart(d) {
  _im = { mp: true, you: d.you, matchId: d.matchId, board: null };
  const me = d.you === 'a' ? d.teamA : d.teamB;
  const opp = d.you === 'a' ? d.teamB : d.teamA;
  imMountBoard('match-stage', {
    phaseLabel: d.phaseLabel,
    meName: me.name, meFlag: me.flag || '🎮', oppName: opp.name, oppFlag: opp.flag || '🏳️',
    mePlayers: me.players, meTactic: me.tactic, meStats: me.stats, meCaptainId: me.captainId, meSlots: me.slots, meFormation: me.formation,
    oppPlayers: opp.players, oppTactic: opp.tactic, oppStats: opp.stats, oppCaptainId: opp.captainId, oppSlots: opp.slots, oppFormation: opp.formation,
  });
  imUpdateScore(0, 0); imUpdateClock(0); imUpdateProgress(0);
  imMpBars(100, 100, false, false, 0, 0);
}

// match_clock do servidor → atualiza placar/relógio/barras + gols de fundo.
function imMpClock(d) {
  if (!_im || !_im.board) return;
  const you = _im.you;
  imUpdateScore(you === 'a' ? d.scoreA : d.scoreB, you === 'a' ? d.scoreB : d.scoreA);
  imUpdateClock(d.clock); imUpdateProgress(d.clock / 90);
  (d.goals || []).forEach(g => imAddGoalFeed(g.side === you, g.scorer, g.minute));
  imMpBars(you === 'a' ? d.staminaA : d.staminaB, you === 'a' ? d.staminaB : d.staminaA,
    you === 'a' ? d.momentumA : d.momentumB, you === 'a' ? d.momentumB : d.momentumA,
    you === 'a' ? d.redA : d.redB, you === 'a' ? d.redB : d.redA);
}

// event_result do servidor → atualiza estado + reveal auto-dispensável.
function imMpEventResult(d) {
  const you = (_im && _im.you) || 'a';
  if (d.outcome === 'goal') imAddGoalFeed(d.atkSide === you, d.scorer, d.minute);
  imUpdateScore(you === 'a' ? d.scoreA : d.scoreB, you === 'a' ? d.scoreB : d.scoreA);
  imMpBars(you === 'a' ? d.staminaA : d.staminaB, you === 'a' ? d.staminaB : d.staminaA,
    you === 'a' ? d.momentumA : d.momentumB, you === 'a' ? d.momentumB : d.momentumA,
    you === 'a' ? d.redA : d.redB, you === 'a' ? d.redB : d.redA);
  return imShowEventReveal({
    atkKey: d.atkKey, defKey: d.defKey, humanIsAtk: (d.atkSide === you), humanSide: you, minute: d.minute,
    result: { outcome: d.outcome, pGoal: d.pGoal, scorer: d.scorer, redCard: d.redCard, momentumGranted: d.momentumGranted },
  }, { auto: 1300 });
}

// pen_result do servidor → reveal auto-dispensável.
function imMpPenResult(d) {
  const you = (_im && _im.you) || 'a';
  const me = you === 'a' ? d.sa : d.sb, opp = you === 'a' ? d.sb : d.sa;
  return imShowPenReveal({
    kickerName: d.kicker.name, humanKicked: (d.team === you),
    kickDir: d.kickDir, diveDir: d.diveDir, result: d.result, scored: d.scored,
    tally: `Você ${me} — ${opp} Adversário`,
  }, { auto: 1200 });
}

// Estado de espera no modal (após enviar a escolha, aguardando o servidor).
function imWaiting(msg) {
  imShowModal(`<div class="im-waiting-box"><div class="spinner"></div><p>${escapeHtml(msg || 'Aguardando…')}</p></div>`);
}
