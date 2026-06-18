const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const E = require('./public/js/engine.js'); // motor compartilhado client/server
const db = require('./db.js');               // persistência (PostgreSQL / memória)

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API REST: perfil + ranking diário ────────────────────────
app.get('/api/profile/:uid', async (req, res) => {
  try {
    const profile = await db.getProfile(req.params.uid);
    res.json({ profile });
  } catch (e) { console.error('GET /api/profile', e); res.status(500).json({ error: 'db' }); }
});

app.put('/api/profile/:uid', async (req, res) => {
  try {
    const saved = await db.saveProfile(req.params.uid, req.body || {});
    res.json({ ok: true, profile: saved });
  } catch (e) { console.error('PUT /api/profile', e); res.status(500).json({ error: 'db' }); }
});

app.post('/api/daily', async (req, res) => {
  try {
    const { date, uid, name, score, detail } = req.body || {};
    if (!date || !uid) return res.status(400).json({ error: 'date e uid obrigatórios' });
    await db.submitDaily({ date, uid, name, score, detail });
    const scores = await db.getLeaderboard(date, 50);
    res.json({ ok: true, scores });
  } catch (e) { console.error('POST /api/daily', e); res.status(500).json({ error: 'db' }); }
});

app.get('/api/daily/:date', async (req, res) => {
  try {
    const scores = await db.getLeaderboard(req.params.date, 50);
    res.json({ scores });
  } catch (e) { console.error('GET /api/daily', e); res.status(500).json({ error: 'db' }); }
});

// Map<roomCode, { players: [socketId], teams: [team|null, team|null], timeout: Timer|null }>
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Normaliza o payload do draft (array antigo OU objeto novo { players, slots, tactic, captainId })
function normalizeTeam(payload) {
  if (Array.isArray(payload)) return { players: payload };
  return {
    players: payload.players || [],
    slots: payload.slots || null,
    tactic: payload.tactic || null,
    captainId: payload.captainId || null,
  };
}

// Simula o confronto direto usando o motor compartilhado (mesma matemática do client).
function simulateMultiplayerMatch(teamA, teamB) {
  const seed = E.generateSeed();
  return E.simulateVersus(normalizeTeam(teamA), normalizeTeam(teamB), seed);
}

io.on('connection', (socket) => {
  socket.on('create_room', (cb) => {
    const code = generateRoomCode();
    rooms.set(code, { players: [socket.id], teams: [null, null], timeout: null });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;
    if (typeof cb === 'function') cb({ roomCode: code });
  });

  socket.on('join_room', (code, cb) => {
    const room = rooms.get(code);
    if (!room) return typeof cb === 'function' && cb({ error: 'Sala não encontrada.' });
    if (room.players.length >= 2) return typeof cb === 'function' && cb({ error: 'Sala cheia.' });
    room.players.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 1;
    if (typeof cb === 'function') cb({ ok: true });
    socket.to(code).emit('opponent_joined');
    io.to(code).emit('both_connected');
  });

  socket.on('draft_complete', (team) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms.get(code);
    if (!room || idx === undefined) return;
    room.teams[idx] = team;
    socket.to(code).emit('opponent_ready');
    if (room.teams[0] && room.teams[1]) {
      const result = simulateMultiplayerMatch(room.teams[0], room.teams[1]);
      io.to(code).emit('match_result', {
        ...result,
        teamA: normalizeTeam(room.teams[0]).players,
        teamB: normalizeTeam(room.teams[1]).players,
      });
      // Clean up room after 5 min
      room.timeout = setTimeout(() => rooms.delete(code), 5 * 60 * 1000);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    socket.to(code).emit('opponent_disconnected');
    // Give 30s for reconnect before deleting
    room.timeout = setTimeout(() => {
      if (rooms.get(code) === room) rooms.delete(code);
    }, 30_000);
  });
});

const PORT = process.env.PORT || 3000;
db.init()
  .catch(err => console.error('[db] falha ao inicializar:', err.message))
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`7a0 — Sete a Zero rodando em http://localhost:${PORT}`);
    });
  });
