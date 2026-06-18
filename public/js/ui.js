/* ============================================================
   7a0 — UI / Rendering
   ============================================================ */

// ── Player Card (FUT) ─────────────────────────────────────────
// Componente reutilizável de carta de jogador. size: 'sm' | 'md' | 'lg'.
function renderPlayerCard(player, opts) {
  opts = opts || {};
  const size = opts.size || 'md';
  const showRating = opts.mode ? opts.mode === 'classic' : (state.mode === 'classic');
  const tier = getTier(player.overall);
  const style = (typeof getStyle === 'function') ? getStyle(player) : null;
  const styleInfo = (style && typeof PLAY_STYLES !== 'undefined') ? PLAY_STYLES[style] : null;
  const ovr = showRating ? player.overall : '?';
  const pos = player.position;
  const shortName = player.name.length > 14 ? player.name.split(' ').pop() : player.name;
  const isCaptain = opts.captain || (state.captainId && state.captainId === player.id);

  return `
    <div class="fut-card tier-${tier} size-${size}${opts.selected ? ' selected' : ''}${isCaptain ? ' captain' : ''}"${opts.dataId ? ` data-id="${player.id}"` : ''}>
      <div class="fut-shine"></div>
      ${isCaptain ? '<div class="fut-captain">C</div>' : ''}
      <div class="fut-top">
        <div class="fut-ovr">${ovr}</div>
        <div class="fut-pos">${pos}</div>
      </div>
      <div class="fut-flag">${player.flag || '⚽'}</div>
      <div class="fut-name">${shortName}</div>
      <div class="fut-meta">
        ${styleInfo ? `<span class="fut-style" title="${styleInfo.label}">${styleInfo.emoji} ${styleInfo.label}</span>` : ''}
        <span class="fut-wc">Copa ${player.worldCup}</span>
      </div>
    </div>`;
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── Formation Grid ────────────────────────────────────────────
function renderFormationGrid() {
  const grid = document.getElementById('formation-grid');
  grid.innerHTML = '';
  for (const [name, cfg] of Object.entries(FORMATIONS)) {
    const card = document.createElement('div');
    card.className = 'formation-card';
    card.innerHTML = `
      <div class="formation-name">${name}</div>
      <div class="formation-visual">${renderFormationDots(cfg.slots)}</div>
      <div class="formation-desc">${cfg.desc}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.formation-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      setTimeout(() => {
        initDraft(name);
        if (state.isMultiplayer) {
          renderDraftScreen();
          goTo('draft');
        } else {
          renderDraftScreen();
          goTo('draft');
        }
      }, 200);
    });
    grid.appendChild(card);
  }
}

function renderFormationDots(slots) {
  const rows = {};
  const posToRow = {
    GK: 4, LB: 3, RB: 3, CB: 3, LWB: 3, RWB: 3,
    CDM: 2.5, CM: 2, LM: 2, RM: 2, CAM: 1.5,
    LW: 1, RW: 1, ST: 0.5
  };
  for (const pos of slots) {
    const row = posToRow[pos] ?? 2;
    if (!rows[row]) rows[row] = 0;
    rows[row]++;
  }
  const sortedRows = Object.keys(rows).sort((a, b) => b - a);
  return sortedRows.map(r =>
    `<div class="fv-row">${Array(rows[r]).fill('<div class="fv-dot"></div>').join('')}</div>`
  ).join('');
}

// ── Draft Screen ──────────────────────────────────────────────
function renderDraftScreen() {
  document.getElementById('draft-formation-label').textContent = state.formation;
  document.getElementById('draft-mode-badge').textContent =
    state.mode === 'classic' ? 'CLÁSSICO' : 'DE MEMÓRIA';
  _swapSourceIndex = null;
  renderField();
  renderWildcards();
  hideDraftPick();
  updateRerollBtns();
}

// ── Field Visual ──────────────────────────────────────────────
function renderField() {
  const field = document.getElementById('field-visual');
  field.innerHTML = '';
  const positions = FIELD_POSITIONS[state.formation] || [];

  state.slots.forEach((slot, i) => {
    const [y, x] = positions[i] || [50, 50];
    const el = document.createElement('div');
    el.className = 'field-slot';
    el.style.left = `${x}%`;
    el.style.top  = `${y}%`;

    const openPositions = getOpenPositions();
    const isActive = !slot.player && openPositions.length > 0 && openPositions[0] === slot.pos;

    if (slot.player) {
      const tier = getTier(slot.player.overall);
      const isSwapSource = _swapSourceIndex === i;
      el.className = 'field-slot clickable';
      el.innerHTML = `
        <div class="slot-circle filled tier-${tier}${isSwapSource ? ' swap-source' : ''}">
          ${state.mode === 'classic' ? slot.player.overall : '?'}
        </div>
        <div class="slot-name">${slot.player.name.split(' ').pop()}</div>
        <div class="slot-ovr">${slot.pos}</div>
      `;
      el.addEventListener('click', () => {
        if (state.currentRoll) return;
        if (_swapSourceIndex !== null) {
          handleSwapClick(i);
        } else {
          startSwapMode(i);
        }
      });
    } else {
      const isDropTarget = _selectedPickPlayer && playerFitsSlot(_selectedPickPlayer, slot.pos);
      el.innerHTML = `
        <div class="slot-circle ${isDropTarget ? 'drop-target' : (isActive ? 'active' : '')}">${slot.pos}</div>
        <div class="slot-name"></div>
      `;
      if (isDropTarget) {
        el.className = 'field-slot clickable';
        el.addEventListener('click', () => {
          if (pickPlayerToSlot(_selectedPickPlayer.id, i)) {
            hidePositionSelector();
            hideDraftPick();
            renderField();
            updateRerollBtns();
          }
        });
      } else if (_swapSourceIndex !== null) {
        el.className = 'field-slot clickable';
        el.addEventListener('click', () => handleSwapClick(i));
      }
    }
    field.appendChild(el);
  });

  // Overlay de química (linhas entre estilos que sinergizam)
  renderChemistryOverlay(field);

  // Draft completo → escolher tática e capitão antes de simular/enviar
  if (isDraftComplete()) {
    const stats = calcTeamStats(state.pickedPlayers, currentSimOpts());
    showToast(`Time montado! Química ${stats.chemistry}`);
    setTimeout(() => { renderTactics(); goTo('tactics'); }, 600);
  }
}

// ── Overlay de química no campo ───────────────────────────────
function renderChemistryOverlay(field) {
  if (typeof calcChemistry !== 'function') return;
  const positions = FIELD_POSITIONS[state.formation] || [];

  // Jogadores escalados (mantém índice do slot p/ coordenadas)
  const placed = [];
  state.slots.forEach((s, i) => { if (s.player) placed.push({ player: s.player, slotIndex: i }); });

  const badge = document.getElementById('draft-chem');
  const badgeVal = document.getElementById('draft-chem-val');

  if (placed.length < 2) { if (badge) badge.style.display = 'none'; return; }

  const chem = calcChemistry(
    placed.map(p => p.player),
    { tactic: state.tactic, captainId: state.captainId, slots: placed.map(p => state.slots[p.slotIndex].pos) }
  );

  if (badge && badgeVal) { badge.style.display = ''; badgeVal.textContent = chem.chemistry; }

  let svg = '<svg class="chem-svg" viewBox="0 0 100 100" preserveAspectRatio="none">';
  for (const link of chem.links) {
    const sa = placed[link.a].slotIndex, sb = placed[link.b].slotIndex;
    const pa = positions[sa], pb = positions[sb];
    if (!pa || !pb) continue;
    svg += `<line x1="${pa[1]}" y1="${pa[0]}" x2="${pb[1]}" y2="${pb[0]}" class="chem-line ${link.type}" />`;
  }
  svg += '</svg>';
  field.insertAdjacentHTML('afterbegin', svg);
}

// ── Draft Pick List ───────────────────────────────────────────
function renderDraftPick(roll) {
  document.getElementById('draft-waiting').style.display = 'none';
  const pickList = document.getElementById('draft-pick-list');
  pickList.classList.remove('hidden');

  document.getElementById('pick-flag').textContent = roll.squad.flag;
  document.getElementById('pick-country').textContent = roll.squad.country;
  document.getElementById('pick-year').textContent = `Copa ${roll.squad.worldCup}`;

  hidePositionSelector();

  const openPositions = getOpenPositions();
  const list = document.getElementById('players-list');
  list.innerHTML = '';

  const sorted = [...roll.players].sort((a, b) => b.overall - a.overall);
  sorted.forEach((player, idx) => {
    const alreadyPicked = state.slots.some(s => s.player && s.player.id === player.id);
    const compatible = !alreadyPicked && openPositions.some(op => playerFitsSlot(player, op));
    const card = document.createElement('div');
    card.className = `player-card${compatible ? '' : ' incompatible'}`;
    card.style.animationDelay = `${Math.min(idx * 40, 400)}ms`;
    card.innerHTML = renderPlayerCard(player, { size: 'md' });
    if (compatible) {
      card.addEventListener('click', () => selectPickPlayer(player, card));
    }
    list.appendChild(card);
  });

  updateRerollBtns();
}

// ── Position Selector ─────────────────────────────────────────
let _selectedPickPlayer = null;

function selectPickPlayer(player, cardEl) {
  if (_selectedPickPlayer?.id === player.id) {
    _selectedPickPlayer = null;
    document.querySelectorAll('.player-card.pick-selected').forEach(c => c.classList.remove('pick-selected'));
    renderField();
    return;
  }
  _selectedPickPlayer = player;
  document.querySelectorAll('.player-card.pick-selected').forEach(c => c.classList.remove('pick-selected'));
  cardEl.classList.add('pick-selected');
  renderField();
}

function hidePositionSelector() {
  _selectedPickPlayer = null;
  document.querySelectorAll('.player-card.pick-selected').forEach(c => c.classList.remove('pick-selected'));
  document.getElementById('position-selector').classList.add('hidden');
  document.getElementById('players-list').classList.remove('hidden');
}

function hideDraftPick() {
  document.getElementById('draft-waiting').style.display = '';
  document.getElementById('draft-pick-list').classList.add('hidden');
  hidePositionSelector();
}

// ── Swap mode (mover jogadores já escalados) ──────────────────
let _swapSourceIndex = null;

function startSwapMode(slotIndex) {
  _swapSourceIndex = slotIndex;
  renderField();
  showToast('Clique em outro jogador para trocar, ou no mesmo para cancelar.');
}

function handleSwapClick(slotIndex) {
  if (_swapSourceIndex === slotIndex) {
    _swapSourceIndex = null;
    renderField();
    return;
  }
  movePlayer(_swapSourceIndex, slotIndex);
  _swapSourceIndex = null;
  renderField();
  showToast('Posições trocadas!');
}

function cancelSwapMode() {
  _swapSourceIndex = null;
  renderField();
}

// ── Wildcards ─────────────────────────────────────────────────
function renderWildcards() {
  const container = document.getElementById('wildcards-display');
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const w = document.createElement('span');
    w.className = `wildcard${i >= state.wildcards ? ' used' : ''}`;
    w.textContent = '⚡';
    container.appendChild(w);
  }
}

// ── Simulation Screen ─────────────────────────────────────────
function renderSimulation() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  const stats = calcTeamStats(players);

  document.getElementById('sim-overall').textContent = stats.overall;

  // Team preview cards
  const preview = document.getElementById('sim-team-preview');
  preview.innerHTML = players.map(p => renderPlayerCard(p, { size: 'sm' })).join('');

  // Stage cards (pending)
  const stages = document.getElementById('sim-stages');
  stages.innerHTML = STAGE_CONFIG.map(s => `
    <div class="stage-card" id="stage-${s.id}">
      <div class="stage-card-top">
        <span class="stage-name">${s.label}</span>
        <span class="stage-result pending">Aguardando</span>
      </div>
      <div class="stage-events"></div>
    </div>
  `).join('');
}

// ── Results Screen ────────────────────────────────────────────
function renderResults(simResult, players) {
  const { results, champion, stats } = simResult;
  const trophy = document.getElementById('results-trophy');
  const title  = document.getElementById('results-title');
  const sub    = document.getElementById('results-subtitle');

  if (champion) {
    trophy.textContent = '🏆';
    title.textContent  = 'CAMPEÃO DO MUNDO!';
    sub.textContent    = `Time com OVR ${stats.overall} dominou o torneio!`;
    launchConfetti();
  } else {
    const lastResult = [...results].reverse().find(r => r.status !== 'skipped');
    if (lastResult) {
      const stageNames = {
        group1: 'Fase de Grupos', group2: 'Fase de Grupos', group3: 'Fase de Grupos',
        r16: 'Oitavas de Final', qf: 'Quartas de Final', sf: 'Semifinal', final: 'Final'
      };
      trophy.textContent = '⚽';
      title.textContent  = lastResult.advanced ? 'Bom resultado!' : 'Eliminado!';
      sub.textContent    = `Seu time (OVR ${stats.overall}) chegou até: ${stageNames[lastResult.id] || lastResult.label}`;
    }
  }

  // Resumo: química, tática e MVP
  renderResultSummary(simResult);

  // Stages
  document.getElementById('results-stages').innerHTML = results
    .filter(r => r.status !== 'skipped')
    .map(r => {
      const icon = r.win ? '✓' : (r.draw ? '~' : '✗');
      const allEvents = [
        ...(r.eventsFor    || []).map(e => ({ ...e, team: 'my'  })),
        ...(r.eventsAgainst|| []).map(e => ({ ...e, team: 'opp' })),
      ].sort((a, b) => a.minute - b.minute);
      const eventsHtml = allEvents.length
        ? `<div class="stage-events">${allEvents.map(e =>
            `<span class="goal-event ${e.team === 'my' ? 'my-goal' : 'opp-goal'}">` +
            `⚽ ${e.team === 'my' ? (e.scorer?.name ?? '?') : 'Adversário'} ${e.minute}'` +
            `</span>`
          ).join('')}</div>`
        : '';
      return `
        <div class="result-stage-block">
          <div class="result-stage-row">
            <span class="rs-label">${r.label}</span>
            <span class="rs-score ${r.status}">${r.goalsFor} × ${r.goalsAgainst} ${icon}</span>
          </div>
          ${eventsHtml}
        </div>
      `;
    }).join('');

  // Team
  document.getElementById('results-team').innerHTML =
    players.map(p => renderPlayerCard(p, { size: 'sm', mode: 'classic' })).join('');
}

// ── Tela de Capitão & Táticas ─────────────────────────────────
function renderTactics() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  if (!state.tactic) state.tactic = 'equilibrada';

  // Grade de táticas
  const tg = document.getElementById('tactic-grid');
  tg.innerHTML = Object.entries(TACTICS).map(([key, t]) => {
    const favs = t.favors.length
      ? t.favors.map(f => (PLAY_STYLES[f] ? PLAY_STYLES[f].label : f)).join(', ')
      : 'Sem ênfase';
    return `
      <div class="tactic-card${state.tactic === key ? ' selected' : ''}" data-tactic="${key}">
        <div class="tactic-emoji">${t.emoji}</div>
        <div class="tactic-name">${t.label}</div>
        <div class="tactic-favs">${favs}</div>
      </div>`;
  }).join('');
  tg.querySelectorAll('.tactic-card').forEach(c => {
    c.addEventListener('click', () => { state.tactic = c.dataset.tactic; renderTactics(); });
  });

  // Grade de capitães (cards menores clicáveis)
  const cg = document.getElementById('captain-grid');
  cg.innerHTML = '';
  players.forEach(p => {
    const wrap = document.createElement('div');
    wrap.className = 'captain-pick' + (state.captainId === p.id ? ' selected' : '');
    wrap.innerHTML = renderPlayerCard(p, { size: 'sm', captain: state.captainId === p.id });
    wrap.addEventListener('click', () => {
      state.captainId = (state.captainId === p.id) ? null : p.id;
      renderTactics();
    });
    cg.appendChild(wrap);
  });

  // Texto do botão conforme modo
  const btn = document.getElementById('btn-confirm-tactics');
  if (btn) btn.textContent = state.isMultiplayer ? '✓ Confirmar Time' : '✓ Confirmar e Simular';
}

function confirmTactics() {
  if (state.isMultiplayer || isLocalTournamentMode()) {
    renderPenaltyOrder();
    goTo('penalties');
  } else {
    renderSimulation(); // survival mantém a campanha animada
    goTo('simulation');
  }
}

// Após confirmar a ordem dos pênaltis: multiplayer envia ao servidor;
// modos single-player rodam o torneio localmente.
function onPenaltiesConfirmed() {
  if (state.isMultiplayer) {
    if (typeof sendDraftComplete === 'function') sendDraftComplete();
  } else if (typeof runLocalTournament === 'function') {
    runLocalTournament();
  }
}

// ── Ordem dos pênaltis (multiplayer) ──────────────────────────
function renderPenaltyOrder() {
  const players = state.slots.map(s => s.player).filter(Boolean);
  // Ordem default/atual: usa a salva (filtrada para o time atual) ou ordena por habilidade
  const byId = {}; players.forEach(p => { byId[p.id] = p; });
  let order = (state.penaltyOrder || []).map(id => byId[id]).filter(Boolean);
  const seen = new Set(order.map(p => p.id));
  const rest = players.filter(p => !seen.has(p.id))
    .sort((a, b) => penaltySkillOf(b) - penaltySkillOf(a));
  order = order.concat(rest);
  state.penaltyOrder = order.map(p => p.id);

  const confirmBtn = document.getElementById('btn-confirm-penalties');
  if (confirmBtn) confirmBtn.textContent = state.isMultiplayer ? '✓ Confirmar Time' : '✓ Confirmar e Disputar o Torneio';

  const list = document.getElementById('pen-order-list');
  if (!list) return;
  list.innerHTML = order.map((p, i) => `
    <li class="pen-item" data-id="${p.id}">
      <span class="pen-num">${i + 1}</span>
      <span class="pen-info">
        <span class="pen-name">${escapeHtml(p.name)}</span>
        <span class="pen-pos">${p.position} · OVR ${p.overall}</span>
      </span>
      <span class="pen-skill" title="Habilidade de cobrança">${penaltySkillOf(p)}</span>
      <span class="pen-move">
        <button class="pen-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
        <button class="pen-down" data-i="${i}" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Descer">▼</button>
      </span>
    </li>`).join('');
}

function penaltySkillOf(p) {
  return (typeof penaltySkill === 'function') ? penaltySkill(p) : p.overall;
}

function movePenalty(from, to) {
  const order = state.penaltyOrder.slice();
  if (to < 0 || to >= order.length) return;
  const [m] = order.splice(from, 1);
  order.splice(to, 0, m);
  state.penaltyOrder = order;
  renderPenaltyOrder();
}

// ── Resumo de resultado (química, tática, MVP) ────────────────
function renderResultSummary(simResult) {
  const el = document.getElementById('results-summary');
  if (!el) return;
  const stats = simResult.stats || {};
  const chem = simResult.chemistry ?? stats.chemistry ?? null;
  const tac = (typeof TACTICS !== 'undefined' && simResult.tactic) ? TACTICS[simResult.tactic] : null;
  const mvp = simResult.mvp && simResult.mvp.goals > 0 ? simResult.mvp : null;

  const cards = [];
  cards.push(`<div class="summary-stat"><span class="ss-label">OVR</span><span class="ss-val">${stats.overall ?? '—'}</span></div>`);
  cards.push(`<div class="summary-stat"><span class="ss-label">Ataque</span><span class="ss-val">${stats.attack ?? '—'}</span></div>`);
  cards.push(`<div class="summary-stat"><span class="ss-label">Defesa</span><span class="ss-val">${stats.defense ?? '—'}</span></div>`);
  if (chem != null) cards.push(`<div class="summary-stat chem"><span class="ss-label">Química</span><span class="ss-val">${chem}</span></div>`);
  if (tac) cards.push(`<div class="summary-stat"><span class="ss-label">Tática</span><span class="ss-val sm">${tac.emoji} ${tac.label}</span></div>`);
  if (mvp) cards.push(`<div class="summary-stat mvp"><span class="ss-label">⭐ Craque</span><span class="ss-val sm">${mvp.name} (${mvp.goals})</span></div>`);

  el.innerHTML = cards.join('');
}

// ── Confete (campeão) ─────────────────────────────────────────
function launchConfetti() {
  let layer = document.getElementById('confetti-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'confetti-layer';
    layer.className = 'confetti-layer';
    document.body.appendChild(layer);
  }
  layer.innerHTML = '';
  const colors = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#ffffff'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('span');
    c.className = 'confetti-piece';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    c.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(c);
  }
  setTimeout(() => { if (layer) layer.innerHTML = ''; }, 4200);
}

// ── Animate simulation stage by stage ────────────────────────
function animateSimulation(simResult) {
  const { results } = simResult;
  document.getElementById('btn-simulate').style.display = 'none';
  let i = 0;
  function showNext() {
    if (i >= results.length) {
      setTimeout(() => {
        renderResults(simResult, state.slots.map(s => s.player).filter(Boolean));
        goTo('results');
        if (typeof onTournamentComplete === 'function') onTournamentComplete(simResult);
      }, 600);
      return;
    }
    const r = results[i];
    const el = document.getElementById(`stage-${r.id}`);
    if (el && r.status !== 'skipped') {
      const scoreEl = el.querySelector('.stage-result');
      scoreEl.textContent = `${r.goalsFor} × ${r.goalsAgainst}`;
      scoreEl.className = `stage-result ${r.status}`;

      const allEvents = [
        ...(r.eventsFor    || []).map(e => ({ ...e, team: 'my'  })),
        ...(r.eventsAgainst|| []).map(e => ({ ...e, team: 'opp' })),
      ].sort((a, b) => a.minute - b.minute);

      const eventsEl = el.querySelector('.stage-events');
      if (eventsEl && allEvents.length > 0) {
        eventsEl.innerHTML = allEvents.map(e =>
          `<span class="goal-event ${e.team === 'my' ? 'my-goal' : 'opp-goal'}">` +
          `⚽ ${e.team === 'my' ? (e.scorer?.name ?? '?') : 'Adversário'} ${e.minute}'` +
          `</span>`
        ).join('');
      }
    }
    i++;
    setTimeout(showNext, 600);
  }
  setTimeout(showNext, 300);
}

// Override the simulate button to animate
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-cancel-pick').addEventListener('click', hidePositionSelector);

  const confirmBtn = document.getElementById('btn-confirm-tactics');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmTactics);
  const backTactics = document.getElementById('back-from-tactics');
  if (backTactics) backTactics.addEventListener('click', () => goTo('draft'));

  // Ordem dos pênaltis (multiplayer)
  const backPen = document.getElementById('back-from-penalties');
  if (backPen) backPen.addEventListener('click', () => goTo('tactics'));
  const confirmPen = document.getElementById('btn-confirm-penalties');
  if (confirmPen) confirmPen.addEventListener('click', onPenaltiesConfirmed);
  const penAuto = document.getElementById('btn-pen-auto');
  if (penAuto) penAuto.addEventListener('click', () => { state.penaltyOrder = null; renderPenaltyOrder(); });
  const penList = document.getElementById('pen-order-list');
  if (penList) penList.addEventListener('click', (e) => {
    const up = e.target.closest('.pen-up'), down = e.target.closest('.pen-down');
    if (up) { const i = +up.dataset.i; movePenalty(i, i - 1); }
    else if (down) { const i = +down.dataset.i; movePenalty(i, i + 1); }
  });

  document.getElementById('btn-simulate').addEventListener('click', () => {
    const players = state.slots.map(s => s.player).filter(Boolean);
    if (players.length < 11) { showToast('Monte o time completo primeiro!'); return; }
    const seed = generateSeed();
    state.simResults = simulateTournament(players, seed, currentSimOpts());
    animateSimulation(state.simResults);
  }, { once: false });
});

// ── Lobby roster (multiplayer) ────────────────────────────────
function renderLobbyRoster(data, myId) {
  const countEl = document.getElementById('roster-count');
  if (countEl) countEl.textContent = data.count;

  const list = document.getElementById('roster-list');
  if (list) {
    list.innerHTML = data.players.map(p => `
      <li class="roster-item${p.id === myId ? ' is-you' : ''}">
        <span class="roster-name">${escapeHtml(p.name)}${p.id === myId ? ' (você)' : ''}</span>
        <span class="roster-tags">
          ${p.isHost ? '<span class="roster-tag host">HOST</span>' : ''}
          ${p.ready ? '<span class="roster-tag ready">PRONTO</span>' : ''}
        </span>
      </li>`).join('');
  }

  const isHost = data.hostId === myId;
  const startBtn = document.getElementById('btn-start-tournament');
  const hint = document.getElementById('roster-hint');
  if (startBtn) {
    startBtn.classList.toggle('hidden', !isHost);
    startBtn.disabled = data.count < 2;
    startBtn.textContent = data.count < 2 ? '▶ Aguardando jogadores…' : `▶ Iniciar Torneio (${data.count})`;
  }
  if (hint) hint.classList.toggle('hidden', isHost);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Resultado do torneio (multiplayer) ────────────────────────
function renderTournamentResult(data) {
  const byId = {};
  data.participants.forEach(p => { byId[p.id] = p; });
  const you = data.youId ? byId[data.youId] : null;
  const champ = data.champion ? byId[data.champion] : null;
  const pName = (id) => byId[id] ? `${byId[id].flag} ${byId[id].name}` : '—';

  // Campeão
  const champEl = document.getElementById('bracket-champion');
  if (champEl) {
    const youWon = champ && you && champ.id === you.id;
    champEl.innerHTML = champ
      ? `<div class="champ-trophy">🏆</div>
         <div class="champ-name">${champ.flag} ${escapeHtml(champ.name)}</div>
         <div class="champ-sub">${youWon ? 'Você é o campeão do mundo!' : 'Campeão do torneio'}</div>`
      : '';
  }

  // Seu caminho
  const pathEl = document.getElementById('bracket-yourpath');
  if (pathEl) {
    if (!you) {
      pathEl.innerHTML = `<div class="yourpath-card">Você entrou como espectador deste torneio.</div>`;
    } else {
      const steps = buildPath(data, you.id);
      pathEl.innerHTML = `
        <div class="yourpath-card">
          <div class="yourpath-title">Seu caminho — ${you.flag} ${escapeHtml(you.name)}</div>
          <div class="yourpath-steps">${steps}</div>
        </div>`;
    }
  }

  // Grupos
  const groupsWrap = document.getElementById('groups-wrap');
  if (groupsWrap) {
    groupsWrap.innerHTML = data.groups.map(g => `
      <div class="group-card">
        <div class="group-name">Grupo ${g.name}</div>
        <table class="group-table">
          <thead><tr><th>#</th><th>Time</th><th>P</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th></tr></thead>
          <tbody>
            ${g.table.map(r => `
              <tr class="${data.youId === r.pid ? 'is-you' : ''} ${r.rank <= 2 ? 'qualified' : ''}">
                <td>${r.rank}</td>
                <td class="gt-name">${byId[r.pid] ? byId[r.pid].flag : ''} ${escapeHtml(byId[r.pid] ? byId[r.pid].name : r.pid)}</td>
                <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
                <td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  }

  // Mata-mata
  const koWrap = document.getElementById('knockout-wrap');
  if (koWrap) {
    koWrap.innerHTML = data.knockout.rounds.map(round => `
      <div class="ko-round">
        <div class="ko-round-title">${round.label}</div>
        ${round.matches.map(m => {
          const winA = m.winner === m.a, winB = m.winner === m.b;
          const youHere = data.youId && (m.a === data.youId || m.b === data.youId);
          const pens = m.pens ? ` <span class="ko-pens">(${m.pens.a}-${m.pens.b} pên${m.pens.suddenDeath ? ', MS' : ''})</span>` : '';
          return `
            <div class="ko-match${youHere ? ' is-you' : ''}">
              <div class="ko-team ${winA ? 'win' : 'lose'}">${pName(m.a)}<span class="ko-score">${m.ga}</span></div>
              <div class="ko-team ${winB ? 'win' : 'lose'}">${pName(m.b)}<span class="ko-score">${m.gb}</span></div>
              ${pens ? `<div class="ko-pens-row">${pens}</div>` : ''}
              ${m.pens && m.pens.kicks ? renderShootout(m, byId) : ''}
            </div>`;
        }).join('')}
      </div>`).join('');
  }
}

// Detalhe da disputa de pênaltis (colapsável), cobrança a cobrança.
function renderShootout(m, byId) {
  const nameA = byId[m.a] ? byId[m.a].name : 'A';
  const nameB = byId[m.b] ? byId[m.b].name : 'B';
  const icon = { goal: '⚽', save: '🧤', miss: '❌' };
  const rows = m.pens.kicks.map(k => {
    const who = k.team === 'a' ? nameA : nameB;
    const res = k.result === 'goal' ? 'Gol' : k.result === 'save' ? 'Defesa' : 'Para fora';
    return `<div class="pk-row pk-${k.team} ${k.scored ? 'pk-goal' : 'pk-miss'}">
      <span class="pk-icon">${icon[k.result] || '•'}</span>
      <span class="pk-kicker">${escapeHtml(k.kicker.name)}</span>
      <span class="pk-team-tag">${escapeHtml(who)}</span>
      <span class="pk-res">${res}</span>
      <span class="pk-tally">${k.sa}-${k.sb}</span>
    </div>`;
  }).join('');
  return `<details class="ko-shootout">
    <summary>Ver pênaltis (${m.pens.a}-${m.pens.b})</summary>
    <div class="pk-list">${rows}</div>
  </details>`;
}

// Resume a trajetória de um participante (grupos + mata-mata)
function buildPath(data, pid) {
  const byId = {};
  data.participants.forEach(p => { byId[p.id] = p; });
  const out = [];

  for (const g of data.groups) {
    const row = g.table.find(r => r.pid === pid);
    if (row) {
      const adv = row.rank <= 2;
      out.push(`<div class="path-step ${adv ? 'ok' : 'out'}">Grupo ${g.name}: ${row.rank}º lugar (${row.pts} pts) — ${adv ? 'classificou' : 'eliminado'}</div>`);
      if (!adv) return out.join('');
      break;
    }
  }
  for (const round of data.knockout.rounds) {
    const m = round.matches.find(x => x.a === pid || x.b === pid);
    if (!m) continue;
    const oppId = m.a === pid ? m.b : m.a;
    const myG = m.a === pid ? m.ga : m.gb;
    const opG = m.a === pid ? m.gb : m.ga;
    const won = m.winner === pid;
    const pens = m.pens ? ` (pên ${m.a === pid ? m.pens.a + '-' + m.pens.b : m.pens.b + '-' + m.pens.a})` : '';
    out.push(`<div class="path-step ${won ? 'ok' : 'out'}">${round.label}: ${myG}×${opG}${pens} vs ${byId[oppId] ? byId[oppId].name : '—'} — ${won ? 'venceu' : 'eliminado'}</div>`);
    if (!won) break;
    if (round.id === 'final' && won) out.push(`<div class="path-step champ">🏆 Campeão!</div>`);
  }
  return out.join('');
}
