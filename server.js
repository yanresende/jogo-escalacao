const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

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

function calcTeamStats(players) {
  const weightMap = {
    ST: { atk: 1.0, def: 0.0 },
    LW: { atk: 0.85, def: 0.0 },
    RW: { atk: 0.85, def: 0.0 },
    CAM: { atk: 0.75, def: 0.1 },
    CM: { atk: 0.5, def: 0.5 },
    LM: { atk: 0.5, def: 0.5 },
    RM: { atk: 0.5, def: 0.5 },
    CDM: { atk: 0.2, def: 0.6 },
    LWB: { atk: 0.3, def: 0.8 },
    RWB: { atk: 0.3, def: 0.8 },
    LB: { atk: 0.1, def: 0.8 },
    RB: { atk: 0.1, def: 0.8 },
    CB: { atk: 0.0, def: 0.95 },
    GK: { atk: 0.0, def: 1.0 },
  };
  let atkSum = 0, atkWeight = 0, defSum = 0, defWeight = 0;
  for (const p of players) {
    const w = weightMap[p.position] || { atk: 0.5, def: 0.5 };
    atkSum += p.overall * w.atk;
    atkWeight += w.atk;
    defSum += p.overall * w.def;
    defWeight += w.def;
  }
  return {
    attack: atkWeight > 0 ? atkSum / atkWeight : 75,
    defense: defWeight > 0 ? defSum / defWeight : 75,
  };
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

const SCORER_WEIGHTS = {
  ST:  1.0, RW: 1.0,  LW: 1.0,
  CAM: 0.7,
  CM:  0.45, LM: 0.45, RM: 0.45,
  CDM: 0.22,
  CB:  0.12, RB: 0.12, LB: 0.12, LWB: 0.12, RWB: 0.12,
  GK:  0.01,
};

const SCORING_GK_EASTER_EGG = new Set([
  "rogerio-ceni-bra-02",
  "rogerio-ceni-bra-06",
  "chilavert-par-98",
  "higuita-col-90",
]);

function pickGoalScorer(players, rng) {
  const weights = players.map(p => {
    const base = SCORER_WEIGHTS[p.position] ?? 0.45;
    const w = (p.position === 'GK' && SCORING_GK_EASTER_EGG.has(p.id)) ? 0.25 : base;
    return p.overall * w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function goalMinute(rng) {
  return 1 + Math.floor(90 * Math.pow(rng(), 0.85));
}

function simulateMultiplayerMatch(teamA, teamB) {
  const seed = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
  const rng = mulberry32(seed);
  const statsA = calcTeamStats(teamA);
  const statsB = calcTeamStats(teamB);

  const lambdaAFor = Math.min(5, Math.max(0.15, 1.4 + (statsA.attack - statsB.defense) * 0.08));
  const lambdaBFor = Math.min(5, Math.max(0.15, 1.4 + (statsB.attack - statsA.defense) * 0.08));

  const goalsA = poisson(lambdaAFor, rng);
  const goalsB = poisson(lambdaBFor, rng);

  const eventsA = [];
  for (let i = 0; i < goalsA; i++) {
    eventsA.push({ scorer: pickGoalScorer(teamA, rng), minute: goalMinute(rng) });
  }
  eventsA.sort((a, b) => a.minute - b.minute);

  const eventsB = [];
  for (let i = 0; i < goalsB; i++) {
    eventsB.push({ scorer: pickGoalScorer(teamB, rng), minute: goalMinute(rng) });
  }
  eventsB.sort((a, b) => a.minute - b.minute);

  return { goalsA, goalsB, statsA, statsB, eventsA, eventsB, seed };
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
        teamA: room.teams[0],
        teamB: room.teams[1],
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
server.listen(PORT, () => {
  console.log(`7a0 — Sete a Zero rodando em http://localhost:${PORT}`);
});
