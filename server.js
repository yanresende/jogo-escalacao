const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const E = require('./public/js/engine.js'); // motor compartilhado client/server
const db = require('./db.js');               // persistência (PostgreSQL / memória)
const tournament = require('./public/js/tournament.js'); // motor de torneio (UMD)

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

// ── Multiplayer: salas de torneio (até 16 jogadores) ─────────
// Map<roomCode, {
//   code, hostId, started, finished,
//   members: [{ id, name, team|null, connected }],
//   draftTimer: Timer|null, cleanupTimer: Timer|null,
// }>
const rooms = new Map();
const MAX_PLAYERS = 16;
// Rede de segurança: o torneio só começa quando TODOS os conectados terminam o draft
// (ver maybeFinish). Este deadline só existe para não travar a sala caso alguém fique
// AFK e nunca envie o time. Por isso é generoso — não é o caminho normal.
const DRAFT_DEADLINE_MS = 5 * 60_000;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Normaliza o payload do draft (array antigo OU objeto { players, slots, tactic, captainId })
function normalizeTeam(payload) {
  if (Array.isArray(payload)) return { players: payload, slots: null, formation: null, tactic: null, captainId: null, penaltyOrder: null };
  return {
    players: payload.players || [],
    slots: payload.slots || null,
    formation: payload.formation || null,
    tactic: payload.tactic || null,
    captainId: payload.captainId || null,
    penaltyOrder: payload.penaltyOrder || null,
  };
}

function sanitizeName(name, fallback) {
  const n = (typeof name === 'string' ? name : '').trim().slice(0, 18);
  return n || fallback;
}

function lobbyState(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    started: room.started,
    max: MAX_PLAYERS,
    count: room.members.length,
    players: room.members.map(m => ({ id: m.id, name: m.name, isHost: m.id === room.hostId, ready: !!m.team })),
  };
}

function broadcastLobby(room) {
  io.to(room.code).emit('lobby_update', lobbyState(room));
}

// Roda o torneio com os times disponíveis e emite o resultado por socket (com youId).
function finishTournament(room) {
  if (room.finished) return;
  room.finished = true;
  if (room.draftTimer) { clearTimeout(room.draftTimer); room.draftTimer = null; }

  const humans = room.members
    .filter(m => m.team && m.team.players && m.team.players.length === 11)
    .map(m => ({ id: m.id, name: m.name, isBot: false, flag: '🎮', team: normalizeTeam(m.team) }));

  const result = tournament.runTournament(humans);

  for (const m of room.members) {
    const youId = result.participants.some(p => p.id === m.id) ? m.id : null;
    io.to(m.id).emit('tournament_result', { ...result, youId });
  }
  // Limpa a sala depois de alguns minutos
  room.cleanupTimer = setTimeout(() => rooms.delete(room.code), 5 * 60 * 1000);
}

function maybeFinish(room) {
  const connected = room.members.filter(m => m.connected);
  if (connected.length > 0 && connected.every(m => m.team)) finishTournament(room);
}

io.on('connection', (socket) => {
  socket.on('create_room', (name, cb) => {
    if (typeof name === 'function') { cb = name; name = ''; }
    // Clique duplo: se já está numa sala, devolve a existente em vez de criar órfã.
    const current = rooms.get(socket.data.roomCode);
    if (current && !current.started) {
      if (typeof cb === 'function') cb({ roomCode: current.code });
      return broadcastLobby(current);
    }
    const code = generateRoomCode();
    const room = {
      code, hostId: socket.id, started: false, finished: false,
      members: [{ id: socket.id, name: sanitizeName(name, 'Host'), team: null, connected: true }],
      draftTimer: null, cleanupTimer: null,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    if (typeof cb === 'function') cb({ roomCode: code });
    broadcastLobby(room);
  });

  socket.on('join_room', (code, name, cb) => {
    if (typeof name === 'function') { cb = name; name = ''; }
    const room = rooms.get(code);
    if (!room) return typeof cb === 'function' && cb({ error: 'Sala não encontrada.' });
    if (room.started) return typeof cb === 'function' && cb({ error: 'O torneio já começou.' });
    // Clique duplo / re-emit: já é membro → idempotente, não duplica no roster.
    if (room.members.some(m => m.id === socket.id)) {
      socket.join(code);
      socket.data.roomCode = code;
      if (typeof cb === 'function') cb({ ok: true });
      return broadcastLobby(room);
    }
    // Já está em outra sala → não permite entrar em duas ao mesmo tempo.
    if (socket.data.roomCode && socket.data.roomCode !== code && rooms.has(socket.data.roomCode)) {
      return typeof cb === 'function' && cb({ error: 'Você já está em outra sala.' });
    }
    if (room.members.length >= MAX_PLAYERS) return typeof cb === 'function' && cb({ error: 'Sala cheia (16).' });
    room.members.push({ id: socket.id, name: sanitizeName(name, `Jogador ${room.members.length + 1}`), team: null, connected: true });
    socket.join(code);
    socket.data.roomCode = code;
    if (typeof cb === 'function') cb({ ok: true });
    broadcastLobby(room);
  });

  socket.on('start_tournament', (cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return typeof cb === 'function' && cb({ error: 'Sala não encontrada.' });
    if (room.hostId !== socket.id) return typeof cb === 'function' && cb({ error: 'Só o host pode iniciar.' });
    if (room.started) return typeof cb === 'function' && cb({ error: 'Já iniciado.' });
    if (room.members.filter(m => m.connected).length < 2) return typeof cb === 'function' && cb({ error: 'Mínimo de 2 jogadores.' });
    room.started = true;
    const bracketSize = tournament.bracketSizeFor(room.members.length);
    if (typeof cb === 'function') cb({ ok: true });
    io.to(room.code).emit('tournament_starting', { bracketSize, count: room.members.length });
    // Deadline: quem não draftar vira ausente (vaga vira bot)
    room.draftTimer = setTimeout(() => finishTournament(room), DRAFT_DEADLINE_MS);
  });

  socket.on('draft_complete', (team) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.started) return;
    const member = room.members.find(m => m.id === socket.id);
    if (!member) return;
    member.team = normalizeTeam(team);
    const connected = room.members.filter(m => m.connected);
    const ready = connected.filter(m => m.team).length;
    // Broadcast para a sala toda (inclui quem acabou de enviar) com o progresso.
    io.to(room.code).emit('opponent_ready', { name: member.name, ready, total: connected.length });
    maybeFinish(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const member = room.members.find(m => m.id === socket.id);
    if (member) member.connected = false;

    if (!room.started) {
      // Remove da sala e reatribui host se necessário
      room.members = room.members.filter(m => m.id !== socket.id);
      if (room.members.length === 0) { rooms.delete(room.code); return; }
      if (room.hostId === socket.id) room.hostId = room.members[0].id;
      broadcastLobby(room);
    } else if (!room.finished) {
      // Time já enviado é mantido; se todos os restantes já draftaram, encerra
      maybeFinish(room);
    }
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
