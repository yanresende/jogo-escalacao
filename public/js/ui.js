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
  renderSimulation();
  if (state.isMultiplayer) {
    if (typeof sendDraftComplete === 'function') sendDraftComplete();
  } else {
    goTo('simulation');
  }
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

  document.getElementById('btn-simulate').addEventListener('click', () => {
    const players = state.slots.map(s => s.player).filter(Boolean);
    if (players.length < 11) { showToast('Monte o time completo primeiro!'); return; }
    const seed = generateSeed();
    state.simResults = simulateTournament(players, seed, currentSimOpts());
    animateSimulation(state.simResults);
  }, { once: false });
});

// ── Match result (multiplayer) ────────────────────────────────
function renderMatchResult(data, isPlayerA) {
  const myGoals  = isPlayerA ? data.goalsA : data.goalsB;
  const oppGoals = isPlayerA ? data.goalsB : data.goalsA;
  const myStats  = isPlayerA ? data.statsA : data.statsB;
  const oppStats = isPlayerA ? data.statsB : data.statsA;

  document.getElementById('match-score-a').textContent = myGoals;
  document.getElementById('match-score-b').textContent = oppGoals;

  const winnerEl = document.getElementById('match-winner');
  if (myGoals > oppGoals) {
    winnerEl.textContent = '🏆 Você Venceu!';
    winnerEl.className = 'match-winner you-win';
  } else if (myGoals < oppGoals) {
    winnerEl.textContent = '💀 Você Perdeu!';
    winnerEl.className = 'match-winner you-lose';
  } else {
    winnerEl.textContent = '🤝 Empate!';
    winnerEl.className = 'match-winner draw';
  }

  document.getElementById('match-stats').innerHTML = `
    <div class="stat-row"><span class="stat-label">Seu OVR médio</span><span class="stat-val">${myStats.overall}</span></div>
    <div class="stat-row"><span class="stat-label">Seu Ataque</span><span class="stat-val">${myStats.attack}</span></div>
    <div class="stat-row"><span class="stat-label">Sua Defesa</span><span class="stat-val">${myStats.defense}</span></div>
    <div class="stat-row"><span class="stat-label">OVR do Oponente</span><span class="stat-val">${oppStats.overall}</span></div>
  `;

  const myEvents  = isPlayerA ? (data.eventsA || []) : (data.eventsB || []);
  const oppEvents = isPlayerA ? (data.eventsB || []) : (data.eventsA || []);
  const allEvents = [
    ...myEvents .map(e => ({ ...e, team: 'my'  })),
    ...oppEvents.map(e => ({ ...e, team: 'opp' })),
  ].sort((a, b) => a.minute - b.minute);

  const matchEventsEl = document.getElementById('match-events');
  if (matchEventsEl) {
    if (allEvents.length > 0) {
      matchEventsEl.classList.remove('hidden');
      matchEventsEl.innerHTML =
        `<div class="match-events-title">Linha do Tempo</div>` +
        `<div class="events-timeline">` +
        allEvents.map(e =>
          `<div class="event-row ${e.team === 'my' ? 'my-event' : 'opp-event'}">` +
          `<span class="event-minute">${e.minute}'</span>` +
          `<span class="event-ball">⚽</span>` +
          `<span class="event-name">${e.scorer?.name ?? 'Adversário'}</span>` +
          `</div>`
        ).join('') +
        `</div>`;
    } else {
      matchEventsEl.classList.add('hidden');
    }
  }

  goTo('match');
}
