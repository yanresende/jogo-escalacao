/* ============================================================
   7a0 — Multiplayer Client (Socket.io) — Torneio até 16 jogadores
   ============================================================ */

let socket = null;
let lobby = null; // último lobby_update recebido

function getNickname() {
  const el = document.getElementById('nickname-input');
  const typed = el && el.value.trim();
  if (typed) return typed.slice(0, 18);
  if (typeof Profile !== 'undefined' && Profile.data && Profile.data.name) return Profile.data.name;
  return 'Jogador';
}

function initSocket() {
  if (socket) return;
  socket = io();

  socket.on('lobby_update', (data) => {
    lobby = data;
    showLobbyRoom();
    renderLobbyRoster(data, socket.id);
  });

  socket.on('tournament_starting', (info) => {
    state.isMultiplayer = true;
    state.eventsMode = !!(info && info.interactive);
    state.eventCount = (info && info.eventCount) || 5;
    const extra = state.eventsMode ? ' ⚔️ Modo interativo!' : '';
    showToast(`Torneio iniciado! Chave de ${info.bracketSize}.${extra} Monte seu time.`);
    goTo('formation');
    renderFormationGrid();
  });

  // ── Modo interativo: partidas ao vivo mediadas pelo servidor ──
  socket.on('round_phase', (info) => {
    if (info && info.label) showToast(info.label);
  });
  socket.on('match_start', (d) => {
    goTo('bracket');
    ['bracket-champion', 'bracket-yourpath', 'groups-wrap', 'knockout-wrap'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    if (typeof imMpStart === 'function') imMpStart(d);
  });
  socket.on('match_clock', (d) => { if (typeof imMpClock === 'function') imMpClock(d); });
  socket.on('event_prompt', (d) => {
    if (typeof imAskAction !== 'function') return;
    imAskAction(d.role, d.minute, null, d.timeout).then(key => {
      socket.emit('event_choice', { matchId: d.matchId, action: key });
      if (typeof imWaiting === 'function') imWaiting('Escolha enviada — aguardando o lance…');
    });
  });
  socket.on('event_result', (d) => { if (typeof imMpEventResult === 'function') imMpEventResult(d); });
  socket.on('pen_prompt', (d) => {
    if (typeof imAskDirection !== 'function') return;
    const text = d.mode === 'kick' ? 'Onde bater?' : 'Onde defender? (adversário vai bater)';
    imAskDirection(text, d.tally || '', d.timeout).then(dir => {
      socket.emit('pen_choice', { matchId: d.matchId, dir });
      if (typeof imWaiting === 'function') imWaiting('Cobrança enviada — aguardando…');
    });
  });
  socket.on('pen_result', (d) => { if (typeof imMpPenResult === 'function') imMpPenResult(d); });
  socket.on('match_end', (d) => {
    if (typeof imHideModal === 'function') imHideModal();
  });

  socket.on('opponent_ready', (d) => {
    if (state.screen === 'waiting') {
      const msg = document.getElementById('waiting-msg');
      if (msg) {
        const counter = (d && typeof d.ready === 'number') ? ` (${d.ready}/${d.total} prontos)` : '';
        msg.innerHTML = `${(d && d.name) || 'Um jogador'} terminou. Aguardando os demais${counter}<span class="dots"></span>`;
      }
    }
  });

  socket.on('tournament_result', (data) => {
    goTo('bracket');
    if (typeof imHideModal === 'function') imHideModal();
    // No modo interativo as partidas já foram jogadas ao vivo → só renderiza o chaveamento final.
    if (state.eventsMode) {
      const stage = document.getElementById('match-stage'); if (stage) stage.innerHTML = '';
      renderTournamentResult(data);
      return;
    }
    // Modo clássico: playback "ao vivo" do caminho do jogador; espectador cai no bracket direto.
    if (data && data.youId && typeof playMatchSequence === 'function') {
      playMatchSequence(data, data.youId, { multiplayer: true });
    } else {
      renderTournamentResult(data);
    }
  });

  socket.on('disconnect', () => {
    showToast('Conexão perdida com o servidor.');
  });
}

// ── Lobby: telas ──────────────────────────────────────────────
function showLobbyRoom() {
  document.getElementById('lobby-entry').classList.add('hidden');
  document.getElementById('lobby-room').classList.remove('hidden');
}
function showLobbyEntry() {
  document.getElementById('lobby-entry').classList.remove('hidden');
  document.getElementById('lobby-room').classList.add('hidden');
}

// Evita cliques repetidos em "Criar"/"Entrar" enquanto a sala não responde
// (sem isso, a mesma pessoa entrava várias vezes na sala, duplicando o roster).
let lobbyPending = false;
function setLobbyBusy(busy) {
  lobbyPending = busy;
  ['btn-create-room', 'btn-join-room'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = busy;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-create-room').addEventListener('click', () => {
    if (lobbyPending) return;
    setLobbyBusy(true);
    initSocket();
    socket.emit('create_room', getNickname(), ({ roomCode }) => {
      document.getElementById('room-code-value').textContent = roomCode;
      // segue para a sala via lobby_update; mantém travado até lá
    });
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    if (lobbyPending) return;
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length < 4) { showLobbyError('Código inválido.'); return; }
    setLobbyBusy(true);
    initSocket();
    socket.emit('join_room', code, getNickname(), ({ ok, error }) => {
      if (error) { setLobbyBusy(false); showLobbyError(error); return; }
      document.getElementById('room-code-value').textContent = code;
    });
  });

  document.getElementById('room-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join-room').click();
  });

  document.getElementById('btn-start-tournament').addEventListener('click', () => {
    if (!socket) return;
    socket.emit('start_tournament', (res) => {
      if (res && res.error) showToast(res.error);
    });
  });

  // Host: alternar modo interativo + nº de lances
  function emitMatchMode() {
    if (!socket) return;
    const interactive = document.getElementById('mm-interactive').checked;
    const selBtn = document.querySelector('#mm-count .mm-c.selected');
    const eventCount = selBtn ? parseInt(selBtn.dataset.count, 10) : 5;
    socket.emit('set_match_mode', { interactive, eventCount }, (res) => {
      if (res && res.error) showToast(res.error);
    });
  }
  const mmChk = document.getElementById('mm-interactive');
  if (mmChk) mmChk.addEventListener('change', () => {
    document.getElementById('mm-count').classList.toggle('hidden', !mmChk.checked);
    emitMatchMode();
  });
  document.querySelectorAll('#mm-count .mm-c').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#mm-count .mm-c').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      emitMatchMode();
    });
  });
});

function showLobbyError(msg) {
  const err = document.getElementById('lobby-error');
  err.textContent = msg;
  err.classList.remove('hidden');
  setTimeout(() => err.classList.add('hidden'), 3000);
}

// ── Envio do time (pós-draft) ─────────────────────────────────
function sendDraftComplete() {
  if (!socket) return;
  const players = state.slots.map(s => s.player).filter(Boolean);
  socket.emit('draft_complete', {
    players,
    slots:        state.slots.map(s => s.pos),
    formation:    state.formation,
    tactic:       state.tactic,
    captainId:    state.captainId,
    penaltyOrder: state.penaltyOrder || players.map(p => p.id),
  });
  goTo('waiting');
}

// Reset do estado multiplayer ao voltar ao menu
function resetMultiplayer() {
  if (socket) { socket.disconnect(); socket = null; }
  lobby = null;
  state.isMultiplayer = false;
  setLobbyBusy(false);
  showLobbyEntry();
}
