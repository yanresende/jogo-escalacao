/* ============================================================
   7a0 — Motor de Torneio (compartilhado client + server)
   Formato Copa do Mundo: grupos de 4 → mata-mata até a final.
   Reusa o motor compartilhado (engine.js) para cada partida.
   Padrão UMD: no browser usa os globais; no Node, require.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./engine.js'), require('./data.js')); // Node (server.js)
  } else {
    // Browser: funções do engine estão em window (Object.assign); mas SQUAD_LIST é
    // um `const` de topo (binding léxico global, não propriedade de window) — passa por nome.
    root.Tournament = factory(root, { SQUAD_LIST: SQUAD_LIST, playerFitsSlot: playerFitsSlot });
  }
})(typeof self !== 'undefined' ? self : this, function (E, data) {
  'use strict';

  const SQUAD_LIST = data.SQUAD_LIST;
  const playerFitsSlot = data.playerFitsSlot;

  // Templates de formação usados para montar o XI dos bots (seleções reais).
  const BOT_FORMATIONS = [
    ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CM', 'RW', 'ST', 'LW'], // 4-3-3
    ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'], // 4-4-2
    ['GK', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'LWB', 'ST', 'ST'], // 3-5-2
  ];

  // Bots escolhem uma tática plausível conforme o estilo da escalação.
  const BOT_TACTICS = ['equilibrada', 'ofensiva', 'defensiva', 'contra-ataque', 'posse'];

  // Cruzamentos do mata-mata por nº de grupos. Cada par [grupoIdx, rank(0=1º,1=2º)].
  const KO_SEEDING = {
    4:  [[0, 0], [0, 1]],                                   // 1 grupo → final
    8:  [[0, 0], [1, 1], [1, 0], [0, 1]],                   // 2 grupos → semis
    16: [[0, 0], [1, 1], [2, 0], [3, 1],                    // 4 grupos → quartas
         [1, 0], [0, 1], [3, 0], [2, 1]],
  };

  const GROUP_NAMES = ['A', 'B', 'C', 'D'];
  const RR4 = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]; // round-robin de 4

  function bracketSizeFor(n) {
    if (n <= 4) return 4;
    if (n <= 8) return 8;
    return 16;
  }

  function squadAvg(s) {
    return s.players.reduce((a, p) => a + p.overall, 0) / s.players.length;
  }

  // Escolhe uma tática para o bot com base na média de overall dos atacantes.
  function botTactic(xi, rng) {
    return BOT_TACTICS[Math.floor(rng() * BOT_TACTICS.length)];
  }

  // Monta o XI mais forte de uma seleção respeitando uma formação viável.
  function buildBotTeam(squad, rng) {
    const sorted = [...squad.players].sort((a, b) => b.overall - a.overall);
    for (const formation of BOT_FORMATIONS) {
      const used = new Set();
      const xi = [];
      let ok = true;
      for (const pos of formation) {
        const pick = sorted.find(p => !used.has(p.id) && playerFitsSlot(p, pos));
        if (!pick) { ok = false; break; }
        used.add(pick.id);
        xi.push(pick);
      }
      if (ok && xi.length === 11) {
        return { players: xi, slots: formation, tactic: rng ? botTactic(xi, rng) : 'equilibrada', captainId: xi[0].id };
      }
    }
    // Fallback: 11 melhores por overall, com as próprias posições
    const xi = sorted.slice(0, 11);
    return { players: xi, slots: xi.map(p => p.position), tactic: 'equilibrada', captainId: xi[0] && xi[0].id };
  }

  // Seleciona N seleções distintas (>=11 jogadores) de forma determinística (seed).
  // opts.minAvgOverall filtra para seleções mais fortes (dificuldade da carreira).
  function pickBotSquads(n, seed, opts) {
    const rng = E.mulberry32(seed);
    let eligible = SQUAD_LIST.filter(s => s.players.length >= 11);
    if (opts && opts.minAvgOverall) {
      const sorted = [...eligible].sort((a, b) => squadAvg(b) - squadAvg(a));
      const strong = sorted.filter(s => squadAvg(s) >= opts.minAvgOverall);
      // Há fortes suficientes? usa só elas; senão, pega as ~N mais fortes disponíveis.
      eligible = strong.length >= n ? strong : sorted.slice(0, Math.max(n + 4, 20));
    }
    const pool = [...eligible];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  function teamStats(team) {
    const chem = E.calcChemistry(team.players, team);
    const stats = E.calcTeamStats(team.players, { tactic: team.tactic, chemistry: chem });
    return { ...stats, chemistry: chem.chemistry };
  }

  function seedFor(base, key) {
    return E.hashStringToSeed(String(base) + ':' + key);
  }

  // Joga uma partida; em mata-mata resolve empate nos pênaltis (determinístico).
  function playMatch(pa, pb, baseSeed, key, knockout) {
    const seed = seedFor(baseSeed, key);
    const r = E.simulateVersus(pa.team, pb.team, seed);
    const out = { a: pa.id, b: pb.id, ga: r.goalsA, gb: r.goalsB, eventsA: r.eventsA, eventsB: r.eventsB };
    if (knockout && r.goalsA === r.goalsB) {
      const so = E.simulateShootout(pa.team, pb.team, seedFor(baseSeed, key + ':pens'));
      out.pens = { a: so.a, b: so.b, kicks: so.kicks, suddenDeath: so.suddenDeath };
      out.winner = so.winner === 'a' ? pa.id : pb.id;
    } else if (knockout) {
      out.winner = r.goalsA > r.goalsB ? pa.id : pb.id;
    }
    return out;
  }

  function emptyRow(pid) {
    return { pid, P: 0, W: 0, D: 0, L: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }

  // runTournament(humanParticipants, opts)
  //   humanParticipants: [{ id, name, isBot, flag, team:{players,slots,tactic,captainId,penaltyOrder} }]
  //   opts: { bracketSize?, seed?, minAvgOverall? }
  function runTournament(humanParticipants, opts) {
    opts = opts || {};
    const size = opts.bracketSize || bracketSizeFor(Math.max(humanParticipants.length, 2));
    const baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : E.generateSeed();

    // Completa com bots (seleções reais distintas)
    const participants = [...humanParticipants];
    const botCount = size - participants.length;
    const botSquads = pickBotSquads(botCount, baseSeed, opts);
    const botRng = E.mulberry32(seedFor(baseSeed, 'bots'));
    for (let i = 0; i < botCount; i++) {
      const sq = botSquads[i];
      if (!sq) break;
      participants.push({
        id: 'bot-' + i,
        name: `${sq.country} ${sq.worldCup}`,
        isBot: true,
        flag: sq.flag,
        team: buildBotTeam(sq, botRng),
      });
    }

    const byId = {};
    for (const p of participants) { p.stats = teamStats(p.team); byId[p.id] = p; }

    // Embaralha e distribui em grupos de 4 (determinístico)
    const order = [...participants];
    const shuf = E.mulberry32(seedFor(baseSeed, 'groups'));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuf() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const numGroups = size / 4;
    const groups = [];
    for (let g = 0; g < numGroups; g++) {
      const members = order.slice(g * 4, g * 4 + 4);
      const table = {};
      members.forEach(m => { table[m.id] = emptyRow(m.id); });
      const matches = [];
      for (const [x, y] of RR4) {
        const r = playMatch(members[x], members[y], baseSeed, `g${g}-${x}${y}`, false);
        matches.push(r);
        const ra = table[r.a], rb = table[r.b];
        ra.P++; rb.P++; ra.gf += r.ga; ra.ga += r.gb; rb.gf += r.gb; rb.ga += r.ga;
        if (r.ga > r.gb) { ra.W++; ra.pts += 3; rb.L++; }
        else if (r.ga < r.gb) { rb.W++; rb.pts += 3; ra.L++; }
        else { ra.D++; rb.D++; ra.pts++; rb.pts++; }
      }
      const rows = members.map(m => table[m.id]);
      rows.forEach(rw => { rw.gd = rw.gf - rw.ga; });
      rows.sort((a, b) =>
        b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
        seedFor(baseSeed, 'tb' + a.pid) - seedFor(baseSeed, 'tb' + b.pid));
      rows.forEach((rw, i) => { rw.rank = i + 1; });
      groups.push({ name: GROUP_NAMES[g], table: rows, matches });
    }

    // Qualificados na ordem do chaveamento
    const seeding = KO_SEEDING[size];
    let alive = seeding.map(([gi, rank]) => byId[groups[gi].table[rank].pid]);

    const rounds = [];
    const labelFor = (entrants) => entrants >= 8 ? { id: 'qf', label: 'Quartas de Final' }
      : entrants === 4 ? { id: 'sf', label: 'Semifinal' }
      : { id: 'final', label: 'Final' };

    while (alive.length >= 2) {
      const meta = labelFor(alive.length);
      const matches = [];
      const next = [];
      for (let i = 0; i < alive.length; i += 2) {
        const pa = alive[i], pb = alive[i + 1];
        const r = playMatch(pa, pb, baseSeed, `${meta.id}-${i}`, true);
        matches.push(r);
        next.push(byId[r.winner]);
      }
      rounds.push({ id: meta.id, label: meta.label, matches });
      alive = next;
    }
    const champion = alive.length === 1 ? alive[0].id : null;

    const slimParticipants = participants.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot, flag: p.flag || '🏳️',
      tactic: p.team.tactic || null,
      captainId: p.team.captainId || null,
      slots: p.team.slots || [],
      formation: p.team.formation || null,
      stats: p.stats,
      teamPlayers: p.team.players.map(pl => ({
        id: pl.id, name: pl.name, position: pl.position, overall: pl.overall, flag: pl.flag, country: pl.country,
      })),
    }));

    return {
      bracketSize: size,
      champion,
      participants: slimParticipants,
      groups: groups.map(g => ({ name: g.name, table: g.table, matches: g.matches })),
      knockout: { rounds },
      seed: baseSeed,
    };
  }

  return { runTournament, bracketSizeFor, buildBotTeam, pickBotSquads };
});
