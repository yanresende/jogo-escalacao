/* ============================================================
   7a0 — Driver de Torneio INTERATIVO no servidor (multiplayer ao vivo)
   Roda o chaveamento RODADA A RODADA. Em cada rodada, todas as partidas
   acontecem em PARALELO (cada humano está em no máximo uma). O servidor é
   autoritativo: roda o relógio, nos minutos de evento pede a escolha
   secreta dos humanos envolvidos (timeout → IA), resolve com events.js e
   transmite o resultado. Bots escolhem por IA instantaneamente.

   Reusa: events.js (motor de eventos), engine.js, tournament.js (bracket).
   ============================================================ */
const E = require('./public/js/engine.js');
const Events = require('./public/js/events.js');
const tournament = require('./public/js/tournament.js');

// Timings (overrideáveis por env para testes rápidos; defaults p/ produção).
const SERVER_TICK_MS = parseInt(process.env.IM_TICK_MS, 10) || 90;       // ms por "minuto" de jogo
const EVENT_REVEAL_MS = parseInt(process.env.IM_REVEAL_MS, 10) || 1500;  // pausa do reveal do lance
const PEN_REVEAL_MS = parseInt(process.env.IM_PEN_MS, 10) || 1300;       // pausa do reveal da cobrança
const CHOICE_TIMEOUT_MS = parseInt(process.env.IM_TIMEOUT_MS, 10) || 18000; // AFK → IA escolhe

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Cria o driver de um torneio interativo para uma sala.
// io: instância socket.io. room: sala. opts: { eventCount }.
// humans: [{ id(socketId), name, team }]. Retorna { run(), onEventChoice(), onPenChoice() }.
function createInteractiveDriver(io, room, humans, opts) {
  opts = opts || {};
  const eventCount = opts.eventCount || 5;
  const bracketSize = 16;

  const humanParticipants = humans.map(h => ({
    id: h.id, name: h.name, isBot: false, flag: '🎮', team: h.team,
  }));
  const bracket = tournament.buildBracket(humanParticipants, { bracketSize });
  const { byId, baseSeed, size, participants, groups } = bracket;

  const sessions = new Map(); // matchId -> session (com pendências de escolha)

  function memberConnected(id) {
    const m = room.members.find(x => x.id === id);
    return !!(m && m.connected);
  }
  // Humano "ativo" = participante não-bot e ainda conectado.
  function isHuman(id) {
    return byId[id] && !byId[id].isBot && memberConnected(id);
  }

  // ── Emites ──────────────────────────────────────────────────
  function emitToSide(m, side, event, data) {
    const id = side === 'a' ? m.a : m.b;
    if (isHuman(id)) io.to(id).emit(event, data);
  }
  function emitBothHumans(m, event, data) {
    emitToSide(m, 'a', event, data);
    emitToSide(m, 'b', event, data);
  }
  function slimTeam(part) {
    return {
      name: part.name, flag: part.flag || '🏳️',
      tactic: part.team.tactic || null, captainId: part.team.captainId || null,
      slots: part.team.slots || [], formation: part.team.formation || null,
      stats: part.stats,
      players: part.team.players.map(p => ({ id: p.id, name: p.name, position: p.position, overall: p.overall, flag: p.flag, country: p.country })),
    };
  }
  function emitMatchStart(m) {
    const pa = byId[m.a], pb = byId[m.b];
    const teamA = slimTeam(pa), teamB = slimTeam(pb);
    emitToSide(m, 'a', 'match_start', { matchId: m.key, phaseLabel: m.phaseLabel, you: 'a', teamA, teamB, eventCount });
    emitToSide(m, 'b', 'match_start', { matchId: m.key, phaseLabel: m.phaseLabel, you: 'b', teamA, teamB, eventCount });
  }
  function clockPayload(m, ms, goals) {
    return {
      matchId: m.key, clock: ms.clock, scoreA: ms.scoreA, scoreB: ms.scoreB,
      staminaA: Math.round(ms.staminaA), staminaB: Math.round(ms.staminaB),
      momentumA: Events.momentumActive(ms, 'a'), momentumB: Events.momentumActive(ms, 'b'),
      redA: ms.redA, redB: ms.redB,
      goals: (goals || []).map(g => ({ side: g.side, scorer: g.scorer ? { name: g.scorer.name } : null, minute: g.minute })),
    };
  }

  // ── Escolha (evento) de um lado: humano (prompt) ou IA ─────
  function getActionChoice(session, m, side, role) {
    const ms = session.ms;
    if (!isHuman(side === 'a' ? m.a : m.b)) {
      return Promise.resolve(Events.botChooseAction(ms, role, side, session.rng));
    }
    const socketId = side === 'a' ? m.a : m.b;
    return new Promise(resolve => {
      let done = false;
      const finish = (key) => {
        if (done) return; done = true; clearTimeout(timer);
        if (session.pending) session.pending.delete(socketId);
        resolve(key);
      };
      if (!session.pending) session.pending = new Map();
      session.pending.set(socketId, { role, side, finish });
      io.to(socketId).emit('event_prompt', { matchId: m.key, minute: ms.clock, role, timeout: CHOICE_TIMEOUT_MS });
      const timer = setTimeout(() => finish(Events.botChooseAction(ms, role, side, session.rng)), CHOICE_TIMEOUT_MS);
    });
  }

  // ── Escolha (pênalti) de um lado ───────────────────────────
  function getPenChoice(session, m, side, mode, tally) {
    if (!isHuman(side === 'a' ? m.a : m.b)) {
      return Promise.resolve(Events.botChooseDirection(session.rng));
    }
    const socketId = side === 'a' ? m.a : m.b;
    return new Promise(resolve => {
      let done = false;
      const finish = (dir) => {
        if (done) return; done = true; clearTimeout(timer);
        if (session.penPending) session.penPending.delete(socketId);
        resolve(dir);
      };
      if (!session.penPending) session.penPending = new Map();
      session.penPending.set(socketId, { finish });
      io.to(socketId).emit('pen_prompt', { matchId: m.key, mode, tally, timeout: CHOICE_TIMEOUT_MS });
      const timer = setTimeout(() => finish(Events.botChooseDirection(session.rng)), CHOICE_TIMEOUT_MS);
    });
  }

  // ── Um lance interativo ────────────────────────────────────
  async function runEvent(session, m, eventsA, eventsB) {
    const ms = session.ms, rng = session.rng;
    const atkSide = Events.pickAttackingSide(ms, rng);
    const defSide = atkSide === 'a' ? 'b' : 'a';
    const [atkKey, defKey] = await Promise.all([
      getActionChoice(session, m, atkSide, 'attacker'),
      getActionChoice(session, m, defSide, 'defender'),
    ]);
    const result = Events.resolveEvent(ms, atkSide, atkKey, defKey, rng);
    if (result.outcome === 'goal') (atkSide === 'a' ? eventsA : eventsB).push({ scorer: result.scorer, minute: ms.clock });
    emitBothHumans(m, 'event_result', {
      matchId: m.key, minute: ms.clock, atkSide, atkKey, defKey,
      outcome: result.outcome, pGoal: result.pGoal,
      scorer: result.scorer ? { name: result.scorer.name } : null,
      redCard: result.redCard, momentumGranted: result.momentumGranted,
      scoreA: ms.scoreA, scoreB: ms.scoreB,
      staminaA: Math.round(ms.staminaA), staminaB: Math.round(ms.staminaB),
      momentumA: Events.momentumActive(ms, 'a'), momentumB: Events.momentumActive(ms, 'b'),
      redA: ms.redA, redB: ms.redB,
    });
    await sleep(EVENT_REVEAL_MS);
  }

  // ── Pênaltis interativos ───────────────────────────────────
  async function runPens(session, m) {
    const pa = byId[m.a], pb = byId[m.b];
    const orderA = Events.penaltyOrderFor(pa.team), orderB = Events.penaltyOrderFor(pb.team);
    const gkA = Events.findGoalkeeper(pa.team), gkB = Events.findGoalkeeper(pb.team);
    let sa = 0, sb = 0, ia = 0, ib = 0;
    const kicks = [];
    const tally = () => `${sa}-${sb}`;

    async function kick(team) {
      const order = team === 'a' ? orderA : orderB;
      const kicker = order[(team === 'a' ? ia : ib) % order.length];
      const keeper = team === 'a' ? gkB : gkA;
      const diveSide = team === 'a' ? 'b' : 'a';
      const [kickDir, diveDir] = await Promise.all([
        getPenChoice(session, m, team, 'kick', tally()),
        getPenChoice(session, m, diveSide, 'dive', tally()),
      ]);
      const res = Events.resolvePenaltyKick(kicker, keeper, kickDir, diveDir, session.rng);
      if (team === 'a') { ia++; if (res.goal) sa++; } else { ib++; if (res.goal) sb++; }
      kicks.push({ team, round: team === 'a' ? ia : ib, kicker: { id: kicker.id, name: kicker.name, position: kicker.position }, result: res.result, scored: res.goal, sa, sb, kickDir, diveDir });
      emitBothHumans(m, 'pen_result', { matchId: m.key, team, kicker: { name: kicker.name }, result: res.result, scored: res.goal, kickDir, diveDir, sa, sb });
      await sleep(PEN_REVEAL_MS);
    }

    for (let i = 0; i < 10; i++) {
      const remA = 5 - ia, remB = 5 - ib;
      if (sa > sb + remB || sb > sa + remA) break;
      await kick(i % 2 === 0 ? 'a' : 'b');
    }
    let guard = 0;
    while (sa === sb && guard++ < 50) { await kick('a'); await kick('b'); }
    return { a: sa, b: sb, kicks, suddenDeath: (ia > 5 || ib > 5), winner: sa > sb ? 'a' : 'b' };
  }

  // ── Uma partida (ao vivo se houver humano; senão simulada) ──
  async function playMatch(m) {
    const humanInvolved = isHuman(m.a) || isHuman(m.b);
    if (!humanInvolved) {
      m.result = tournament.playMatch(byId[m.a], byId[m.b], baseSeed, m.key, m.knockout);
      return;
    }
    const pa = byId[m.a], pb = byId[m.b];
    const seed = E.generateSeed();
    const ms = Events.newMatchState(pa.team, pb.team, { eventCount, seed });
    const rng = E.mulberry32((seed ^ 0xA5A5A5) >>> 0);
    const session = { matchId: m.key, ms, rng };
    sessions.set(m.key, session);

    const eventsA = [], eventsB = [];
    emitMatchStart(m);
    await sleep(400);

    while (ms.clock < 90) {
      const goals = Events.applyBackgroundMinute(ms, rng);
      for (const g of goals) (g.side === 'a' ? eventsA : eventsB).push({ scorer: g.scorer, minute: g.minute });
      emitBothHumans(m, 'match_clock', clockPayload(m, ms, goals));
      if (ms.eventMinutes.includes(ms.clock)) await runEvent(session, m, eventsA, eventsB);
      else await sleep(SERVER_TICK_MS);
    }

    const out = { a: m.a, b: m.b, ga: ms.scoreA, gb: ms.scoreB, eventsA, eventsB };
    if (m.knockout) {
      if (ms.scoreA === ms.scoreB) {
        const pens = await runPens(session, m);
        out.pens = { a: pens.a, b: pens.b, kicks: pens.kicks, suddenDeath: pens.suddenDeath };
        out.winner = pens.winner === 'a' ? m.a : m.b;
      } else {
        out.winner = ms.scoreA > ms.scoreB ? m.a : m.b;
      }
    }
    m.result = out;
    emitBothHumans(m, 'match_end', { matchId: m.key, scoreA: ms.scoreA, scoreB: ms.scoreB, pens: out.pens || null, winner: out.winner || null });
    sessions.delete(m.key);
  }

  async function playRound(matches, phase) {
    io.to(room.code).emit('round_phase', phase);
    await Promise.all(matches.map(m => playMatch(m)));
  }

  // ── Roteamento de escolhas vindas do cliente ───────────────
  function onEventChoice(socketId, payload) {
    if (!payload) return;
    const session = sessions.get(payload.matchId);
    if (!session || !session.pending) return;
    const p = session.pending.get(socketId);
    if (!p) return;
    const valid = p.role === 'attacker' ? Events.ATK_ACTIONS[payload.action] : Events.DEF_ACTIONS[payload.action];
    p.finish(valid ? payload.action : Events.botChooseAction(session.ms, p.role, p.side, session.rng));
  }
  function onPenChoice(socketId, payload) {
    if (!payload) return;
    const session = sessions.get(payload.matchId);
    if (!session || !session.penPending) return;
    const p = session.penPending.get(socketId);
    if (!p) return;
    const dir = Events.DIRECTIONS.includes(payload.dir) ? payload.dir : Events.botChooseDirection(session.rng);
    p.finish(dir);
  }

  // ── Torneio completo ───────────────────────────────────────
  async function run() {
    // Fase de grupos: 3 rodadas (matchdays), cada participante joga 1x por rodada.
    for (let md = 0; md < 3; md++) {
      const matches = [];
      for (let g = 0; g < groups.length; g++) {
        [groups[g].matchPairs[md * 2], groups[g].matchPairs[md * 2 + 1]].forEach(([aId, bId], i) => {
          matches.push({ key: `g${g}-md${md}-${i}`, a: aId, b: bId, knockout: false, groupIdx: g, phaseLabel: `Grupo ${groups[g].name} — Rodada ${md + 1}` });
        });
      }
      await playRound(matches, { phase: 'group', matchday: md + 1, label: `Fase de Grupos — Rodada ${md + 1}` });
      for (const m of matches) {
        tournament.applyGroupResult(groups[m.groupIdx].table, m.result);
        groups[m.groupIdx].matches.push(m.result);
      }
    }
    const finalGroups = groups.map(g => ({ name: g.name, table: tournament.rankGroupRows(g.members.map(mm => g.table[mm.id]), baseSeed), matches: g.matches }));

    // Mata-mata
    let alive = tournament.koSeedingAlive(size, finalGroups, byId);
    const rounds = [];
    while (alive.length >= 2) {
      const meta = tournament.koRoundMeta(alive.length);
      const matches = [];
      for (let i = 0; i < alive.length; i += 2) {
        matches.push({ key: `${meta.id}-${i}`, a: alive[i].id, b: alive[i + 1].id, knockout: true, phaseLabel: meta.label });
      }
      await playRound(matches, { phase: 'ko', label: meta.label });
      rounds.push({ id: meta.id, label: meta.label, matches: matches.map(m => m.result) });
      alive = matches.map(m => byId[m.result.winner]);
    }
    const champion = alive.length === 1 ? alive[0].id : null;

    return {
      bracketSize: size, champion,
      participants: tournament.slimParticipants(participants),
      groups: finalGroups.map(g => ({ name: g.name, table: g.table, matches: g.matches })),
      knockout: { rounds }, seed: baseSeed,
      _participantIds: participants.map(p => p.id),
    };
  }

  return { run, onEventChoice, onPenChoice };
}

module.exports = { createInteractiveDriver };
