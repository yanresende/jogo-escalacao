/* ============================================================
   7a0 — Multiplayer Client (Socket.io)
   ============================================================ */

let socket = null;
let isPlayerA = true;

function initSocket() {
  if (socket) return;
  socket = io();

  socket.on('both_connected', () => {
    showToast('Oponente conectado! Escolha sua formação.');
    // If on lobby screen, advance to formation
    if (state.screen === 'lobby') {
      state.isMultiplayer = true;
      goTo('formation');
      renderFormationGrid();
    }
  });

  socket.on('opponent_joined', () => {
    showToast('Oponente entrou na sala!');
  });

  socket.on('opponent_ready', () => {
    if (state.screen === 'waiting') {
      document.getElementById('waiting-msg').innerHTML =
        'Oponente terminou! Aguardando resultado<span class="dots"></span>';
    }
  });

  socket.on('match_result', (data) => {
    renderMatchResult(data, isPlayerA);
  });

  socket.on('opponent_disconnected', () => {
    showToast('Oponente desconectou da partida.');
    if (state.screen === 'waiting' || state.screen === 'match') {
      setTimeout(() => goTo('menu'), 2000);
    }
  });
}

// ── Create Room ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-create-room').addEventListener('click', () => {
    initSocket();
    isPlayerA = true;
    socket.emit('create_room', ({ roomCode }) => {
      document.getElementById('room-code-value').textContent = roomCode;
      document.getElementById('room-code-display').classList.remove('hidden');
      document.getElementById('btn-create-room').style.display = 'none';
    });
  });

  // ── Join Room ───────────────────────────────────────────────
  document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length < 4) {
      showLobbyError('Código inválido.');
      return;
    }
    initSocket();
    isPlayerA = false;
    socket.emit('join_room', code, ({ ok, error }) => {
      if (error) {
        showLobbyError(error);
      } else {
        showToast('Entrou na sala! Aguardando oponente iniciar...');
        // Advance to formation after joining
        state.isMultiplayer = true;
        goTo('formation');
        renderFormationGrid();
      }
    });
  });

  // Allow Enter key in room code input
  document.getElementById('room-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join-room').click();
  });
});

function showLobbyError(msg) {
  const err = document.getElementById('lobby-error');
  err.textContent = msg;
  err.classList.remove('hidden');
  setTimeout(() => err.classList.add('hidden'), 3000);
}

// ── Send draft complete ───────────────────────────────────────
function sendDraftComplete() {
  if (!socket) return;
  const players = state.slots.map(s => s.player).filter(Boolean);
  socket.emit('draft_complete', players);
  goTo('waiting');
}

// Override isDraftComplete to also notify server in multiplayer mode
const _origPickPlayer = pickPlayer;
window._onDraftCompleteMultiplayer = function () {
  if (state.isMultiplayer && isDraftComplete()) {
    setTimeout(sendDraftComplete, 800);
  }
};

// Patch pickPlayer to trigger multiplayer hook after each pick
const origPickPlayer = window.pickPlayer || pickPlayer;
