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
    showToast(`Torneio iniciado! Chave de ${info.bracketSize}. Monte seu time.`);
    state.isMultiplayer = true;
    goTo('formation');
    renderFormationGrid();
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
    // Playback "ao vivo" do caminho do jogador; espectador (sem youId) cai no bracket direto.
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
