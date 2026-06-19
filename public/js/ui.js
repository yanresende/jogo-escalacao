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
    <div class="fut-card tier-${tier} size-${size}${opts.extraClass ? ' ' + opts.extraClass : ''}${opts.selected ? ' selected' : ''}${isCaptain ? ' captain' : ''}"${opts.dataId ? ` data-id="${player.id}"` : ''}>
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

function renderEmptyFieldCard(posStr, extraClass) {
  return `<div class="fut-card-empty size-xs${extraClass ? ' ' + extraClass : ''}">
    <div class="fut-empty-pos">${posStr}</div>
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
      <div class="formation-visual">${renderFormationField(name)}</div>
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
    gol: 4, le: 3, ld: 3, zag: 3,
    vol: 2.5, mc: 2, me: 2, md: 2, mei: 1.5,
    pe: 1, pd: 1, ca: 0.5
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

// Mini-campo da formação: marcadores nas coordenadas reais (FIELD_POSITIONS),
// com rótulo PT — mesma cara do campo do jogo, em miniatura.
function renderFormationField(name) {
  const slots = (FORMATIONS[name] && FORMATIONS[name].slots) || [];
  const coords = FIELD_POSITIONS[name] || [];
  const marks = slots.map((pos, i) => {
    const [y, x] = coords[i] || [50, 50];
    return `<span class="ff-mark" style="top:${y}%;left:${x}%">${posLabel(pos)}</span>`;
  }).join('');
  return `<div class="formation-field">${marks}</div>`;
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

    const srcSlot = _swapSourceIndex !== null ? state.slots[_swapSourceIndex] : null;

    if (slot.player) {
      const tier = getTier(slot.player.overall);
      const isSwapSource = _swapSourceIndex === i;
      let chemClass = '';
      if (_selectedPickPlayer) {
        const syn = styleSynergy(getStyle(_selectedPickPlayer), getStyle(slot.player));
        if (syn === 2) chemClass = 'chem-sync-strong';
        else if (syn === 1) chemClass = 'chem-sync-same';
        else chemClass = 'chem-no-sync';
      }
      let swapClass = '';
      if (srcSlot && !isSwapSource) {
        const canSwap = srcSlot.player
          && playerFitsSlot(srcSlot.player, slot.pos)
          && playerFitsSlot(slot.player, srcSlot.pos);
        swapClass = canSwap ? 'swap-valid-target' : 'swap-invalid-target';
      }
      const extraClass = [isSwapSource ? 'swap-source' : swapClass, chemClass].filter(Boolean).join(' ');
      el.className = 'field-slot clickable';
      el.innerHTML = renderPlayerCard(slot.player, { size: 'xs', extraClass: extraClass || undefined });
      el.addEventListener('click', () => {
        if (state.currentRoll) {
          if (removePlayerFromSlot(i)) {
            renderField();
            renderDraftPick(state.currentRoll);
          }
          return;
        }
        if (_swapSourceIndex !== null) {
          handleSwapClick(i);
        } else {
          startSwapMode(i);
        }
      });
    } else {
      const isDropTarget = _selectedPickPlayer && playerFitsSlot(_selectedPickPlayer, slot.pos);
      const isValidSwapTarget = srcSlot?.player && playerFitsSlot(srcSlot.player, slot.pos);
      const emptyClass = isDropTarget ? 'drop-target' : (isValidSwapTarget ? 'swap-target' : (isActive ? 'active' : ''));
      el.innerHTML = renderEmptyFieldCard(posLabel(slot.pos), emptyClass);
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
      } else if (isValidSwapTarget) {
        el.className = 'field-slot clickable';
        el.addEventListener('click', () => handleSwapClick(i));
      }
    }

    // Drag-and-drop para trocar posições (sem roll ativo)
    if (!state.currentRoll) {
      if (slot.player) {
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
          _dragSourceIndex = i;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
          requestAnimationFrame(() => el.classList.add('dragging'));
        });
        el.addEventListener('dragend', () => {
          _dragSourceIndex = null;
          el.classList.remove('dragging');
          document.querySelectorAll('.field-slot.drag-over').forEach(d => d.classList.remove('drag-over'));
        });
      }
      el.addEventListener('dragover', (e) => {
        if (_dragSourceIndex === null || _dragSourceIndex === i) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      el.addEventListener('dragenter', (e) => {
        if (_dragSourceIndex === null || _dragSourceIndex === i) return;
        const src = state.slots[_dragSourceIndex];
        const dst = state.slots[i];
        const valid = (!src?.player || playerFitsSlot(src.player, dst.pos))
                   && (!dst?.player || playerFitsSlot(dst.player, src.pos));
        if (!valid) return;
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', (e) => {
        if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (_dragSourceIndex === null || _dragSourceIndex === i) return;
        const moved = movePlayer(_dragSourceIndex, i);
        _dragSourceIndex = null;
        renderField();
        if (moved) showToast('Posições trocadas!');
        else showToast('Posição incompatível para este jogador.');
      });
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
// ── Toggle mobile: campo x lista de jogadores ─────────────────
// No celular só cabe um painel por vez. Enquanto há uma rolagem ativa,
// `.picking` esconde o campo e mostra a lista; o botão alterna p/ `.field-view`.
function setDraftView(view) {
  const layout = document.querySelector('.draft-layout');
  if (!layout) return;
  const btn = document.getElementById('draft-view-toggle');
  if (view === 'field') {
    layout.classList.add('field-view');
    if (btn) btn.textContent = '👥 Ver jogadores';
  } else {
    layout.classList.remove('field-view');
    if (btn) btn.textContent = '🏟️ Ver campo';
  }
}

function renderDraftPick(roll) {
  document.getElementById('draft-waiting').style.display = 'none';
  const pickList = document.getElementById('draft-pick-list');
  pickList.classList.remove('hidden');
  const layout = document.querySelector('.draft-layout');
  if (layout) layout.classList.add('picking');
  setDraftView('pick');

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
    const btn = document.getElementById('draft-view-toggle');
    if (btn) btn.classList.remove('attention');
    renderField();
    return;
  }
  _selectedPickPlayer = player;
  document.querySelectorAll('.player-card.pick-selected').forEach(c => c.classList.remove('pick-selected'));
  cardEl.classList.add('pick-selected');
  // No mobile, sinaliza que é hora de ir ao campo para escalar o selecionado.
  const btn = document.getElementById('draft-view-toggle');
  if (btn) btn.classList.add('attention');
  renderField();
}

function hidePositionSelector() {
  _selectedPickPlayer = null;
  document.querySelectorAll('.player-card.pick-selected').forEach(c => c.classList.remove('pick-selected'));
  const viewToggleBtn = document.getElementById('draft-view-toggle');
  if (viewToggleBtn) viewToggleBtn.classList.remove('attention');
  document.getElementById('position-selector').classList.add('hidden');
  document.getElementById('players-list').classList.remove('hidden');
}

function hideDraftPick() {
  document.getElementById('draft-waiting').style.display = '';
  document.getElementById('draft-pick-list').classList.add('hidden');
  const layout = document.querySelector('.draft-layout');
  if (layout) layout.classList.remove('picking', 'field-view');
  hidePositionSelector();
}

// ── Swap mode (mover jogadores já escalados) ──────────────────
let _swapSourceIndex = null;
let _dragSourceIndex = null;

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
  const moved = movePlayer(_swapSourceIndex, slotIndex);
  _swapSourceIndex = null;
  renderField();
  showToast(moved ? 'Posições trocadas!' : 'Posição incompatível para este jogador.');
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
  const tacticOpts = { tactic: state.tactic, captainId: state.captainId, slots: state.slots.map(s => s.pos) };
  const stats = calcTeamStats(players, tacticOpts);

  document.getElementById('sim-overall').textContent = stats.overall;

  const tactic = (typeof TACTICS !== 'undefined' && state.tactic) ? TACTICS[state.tactic] : null;
  let chemVal = null;
  if (typeof calcChemistry === 'function' && players.length >= 2) {
    chemVal = calcChemistry(players, tacticOpts).chemistry;
  }

  // Campo com jogadores + barra de stats (painel esquerdo, espelho do draft)
  const preview = document.getElementById('sim-team-preview');
  preview.innerHTML = `
    <div class="sim-field-header">
      <span class="sim-formation-badge">${state.formation || ''}</span>
      ${tactic ? `<span class="sim-tactic-badge">${tactic.emoji} ${tactic.label}</span>` : ''}
    </div>
    <div class="sim-field-container">
      <div class="field sim-field" id="sim-field-visual"></div>
    </div>
    <div class="sim-info-row">
      <div class="sim-stat-chip"><span class="ssc-label">ATK</span><span class="ssc-val">${stats.attack}</span></div>
      <div class="sim-stat-chip"><span class="ssc-label">DEF</span><span class="ssc-val">${stats.defense}</span></div>
      <div class="sim-stat-chip ovr"><span class="ssc-label">OVR</span><span class="ssc-val">${stats.overall}</span></div>
      ${chemVal != null ? `<div class="sim-stat-chip chem"><span class="ssc-label">Quím</span><span class="ssc-val">${chemVal}</span></div>` : ''}
    </div>
  `;

  renderSimField();

  // Stage cards (pending) — modo Survival
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

// Campo read-only para a tela de simulação (Survival).
function renderSimField() {
  const field = document.getElementById('sim-field-visual');
  if (!field || !state.formation) return;
  const positions = FIELD_POSITIONS[state.formation] || [];
  field.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const [y, x] = positions[i] || [50, 50];
    const el = document.createElement('div');
    el.className = 'field-slot';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    if (slot.player) {
      el.innerHTML = renderPlayerCard(slot.player, { size: 'xs' });
    } else {
      el.innerHTML = renderEmptyFieldCard(posLabel(slot.pos));
    }
    field.appendChild(el);
  });
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
  const styleOf = (typeof getStyle === 'function') ? getStyle : (p => p.position);

  // Grade de táticas — cada card mostra quais jogadores do time se favorecem
  const tg = document.getElementById('tactic-grid');
  tg.innerHTML = Object.entries(TACTICS).map(([key, t]) => {
    const favs = t.favors.length
      ? t.favors.map(f => (PLAY_STYLES[f] ? PLAY_STYLES[f].label : f)).join(', ')
      : 'Sem ênfase';
    // Jogadores escalados que jogam num estilo premiado por esta tática
    const boosted = t.favors.length ? players.filter(p => t.favors.includes(styleOf(p))) : [];
    let boostLine = '';
    if (t.favors.length) {
      boostLine = boosted.length
        ? `<div class="tactic-boost on">⬆ ${boosted.length} reforçado${boosted.length > 1 ? 's' : ''}<span>${boosted.map(p => p.name).join(', ')}</span></div>`
        : `<div class="tactic-boost off">Nenhum do seu time</div>`;
    }
    return `
      <div class="tactic-card${state.tactic === key ? ' selected' : ''}" data-tactic="${key}">
        <div class="tactic-emoji">${t.emoji}</div>
        <div class="tactic-name">${t.label}</div>
        <div class="tactic-favs">${favs}</div>
        ${boostLine}
      </div>`;
  }).join('');
  tg.querySelectorAll('.tactic-card').forEach(c => {
    c.addEventListener('click', () => { state.tactic = c.dataset.tactic; renderTactics(); });
  });

  // Grade de capitães (cards menores clicáveis) — mostra o estilo de cada jogador
  // e destaca quem ganha bônus por ter o mesmo estilo do capitão escolhido.
  const captain = state.captainId ? players.find(p => p.id === state.captainId) : null;
  const captainStyle = captain ? styleOf(captain) : null;
  const cg = document.getElementById('captain-grid');
  cg.innerHTML = '';
  players.forEach(p => {
    const pStyle = styleOf(p);
    const st = PLAY_STYLES[pStyle];
    const isCap = state.captainId === p.id;
    const boosted = !!captainStyle && !isCap && pStyle === captainStyle;
    const wrap = document.createElement('div');
    wrap.className = 'captain-pick' + (isCap ? ' selected' : '') + (boosted ? ' boosted' : '');
    wrap.innerHTML = renderPlayerCard(p, { size: 'sm', captain: isCap })
      + `<div class="captain-style${boosted ? ' boosted' : ''}${isCap ? ' is-cap' : ''}">`
      + `${st ? st.emoji + ' ' + st.label : pStyle}${boosted ? ' ⬆' : ''}</div>`;
    wrap.addEventListener('click', () => {
      state.captainId = (state.captainId === p.id) ? null : p.id;
      renderTactics();
    });
    cg.appendChild(wrap);
  });

  // Resumo do efeito do capitão escolhido
  const capNote = document.getElementById('captain-note');
  if (capNote) {
    if (captain) {
      const sameStyle = players.filter(p => p.id !== captain.id && styleOf(p) === captainStyle);
      const stLabel = PLAY_STYLES[captainStyle] ? PLAY_STYLES[captainStyle].label : captainStyle;
      capNote.innerHTML = sameStyle.length
        ? `🧢 <b>${captain.name}</b> (${stLabel}) reforça ${sameStyle.length} companheiro${sameStyle.length > 1 ? 's' : ''} do mesmo estilo: <span>${sameStyle.map(p => p.name).join(', ')}</span>`
        : `🧢 <b>${captain.name}</b> (${stLabel}) — nenhum companheiro do mesmo estilo no time.`;
      capNote.style.display = '';
    } else {
      capNote.style.display = 'none';
    }
  }

  updateTacticsConfirmBtn();
}

function updateTacticsConfirmBtn() {
  const btn = document.getElementById('btn-confirm-tactics');
  if (!btn) return;
  const tacticOk = !!state.tactic;
  const captainOk = !!state.captainId;
  btn.disabled = !tacticOk || !captainOk;
  const hints = [];
  if (!tacticOk) hints.push('a tática');
  if (!captainOk) hints.push('o capitão');
  if (hints.length) {
    btn.textContent = `Selecione ${hints.join(' e ')}`;
  } else {
    btn.textContent = state.isMultiplayer ? '✓ Confirmar Time' : '✓ Confirmar e Avançar';
  }
}

function confirmTactics() {
  if (!state.tactic) { showToast('Escolha uma tática antes de continuar.'); return; }
  if (!state.captainId) { showToast('Escolha o capitão antes de continuar.'); return; }
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
        <span class="pen-pos">${posLabel(p.position)} · OVR ${p.overall}</span>
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

  const viewToggle = document.getElementById('draft-view-toggle');
  if (viewToggle) viewToggle.addEventListener('click', () => {
    const layout = document.querySelector('.draft-layout');
    setDraftView(layout && layout.classList.contains('field-view') ? 'pick' : 'field');
  });

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
    // Playback "ao vivo" fase a fase (mesmo motor de cena do torneio).
    if (typeof playMatchSequence === 'function') {
      document.getElementById('btn-simulate').style.display = 'none';
      playMatchSequence(state.simResults, null, {
        survival: true,
        onComplete: () => {
          renderResults(state.simResults, state.slots.map(s => s.player).filter(Boolean));
          goTo('results');
          if (typeof onTournamentComplete === 'function') onTournamentComplete(state.simResults);
        },
      });
    } else {
      animateSimulation(state.simResults); // fallback legado
    }
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

// ── Resultado do torneio (multiplayer / single-player) ────────
// Quebrado em helpers para permitir revelação progressiva (ver match.js).
function tournamentById(data) {
  const byId = {};
  data.participants.forEach(p => { byId[p.id] = p; });
  return byId;
}

function renderTournamentResult(data) {
  const byId = tournamentById(data);
  renderChampionAndPath(data, byId);
  renderGroupsSection(data, byId);
  const koWrap = document.getElementById('knockout-wrap');
  if (koWrap) koWrap.innerHTML = data.knockout.rounds.map(r => renderKnockoutRound(r, data, byId)).join('');
}

// Campeão + "seu caminho"
function renderChampionAndPath(data, byId) {
  byId = byId || tournamentById(data);
  const you = data.youId ? byId[data.youId] : null;
  const champ = data.champion ? byId[data.champion] : null;

  const champEl = document.getElementById('bracket-champion');
  if (champEl) {
    const youWon = champ && you && champ.id === you.id;
    champEl.innerHTML = champ
      ? `<div class="champ-trophy">🏆</div>
         <div class="champ-name">${champ.flag} ${escapeHtml(champ.name)}</div>
         <div class="champ-sub">${youWon ? 'Você é o campeão do mundo!' : 'Campeão do torneio'}</div>`
      : '';
  }

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
}

// Tabelas de todos os grupos
function renderGroupsSection(data, byId) {
  byId = byId || tournamentById(data);
  const groupsWrap = document.getElementById('groups-wrap');
  if (!groupsWrap) return;
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

// HTML de UMA rodada do mata-mata (revelada uma de cada vez no playback)
function renderKnockoutRound(round, data, byId) {
  byId = byId || tournamentById(data);
  const pName = (id) => byId[id] ? `${byId[id].flag} ${byId[id].name}` : '—';
  return `
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
    </div>`;
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
