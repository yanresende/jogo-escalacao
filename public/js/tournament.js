/* ============================================================
   7a0 — Motor de Torneio (compartilhado client + server)
   Formato Copa do Mundo: grupos de 4 → mata-mata até a final.
   Reusa o motor compartilhado (engine.js) para cada partida.
   Padrão UMD: no browser usa os globais; no Node, require.

   Além de runTournament (simula tudo de uma vez, usado pelos modos
   clássicos), expõe buildBracket + helpers de standings para o driver
   do MODO INTERATIVO, que joga partida a partida (ver interactiveMatch.js
   no client e o driver no server.js).
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
    ['gol', 'ld', 'zag', 'zag', 'le', 'mc', 'mc', 'mc', 'pd', 'ca', 'pe'], // 4-3-3
    ['gol', 'ld', 'zag', 'zag', 'le', 'md', 'mc', 'mc', 'me', 'ca', 'ca'], // 4-4-2
    ['gol', 'zag', 'zag', 'zag', 'ld', 'mc', 'mc', 'mc', 'le', 'ca', 'ca'], // 3-5-2
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

  // ── Helpers de standings (reusados por runTournament e pelo driver interativo) ──

  // Aplica o resultado de UM jogo de grupos às linhas das duas equipes.
  // match = { a, b, ga, gb }.
  function applyGroupResult(table, m) {
    const ra = table[m.a], rb = table[m.b];
    ra.P++; rb.P++; ra.gf += m.ga; ra.ga += m.gb; rb.gf += m.gb; rb.ga += m.ga;
    if (m.ga > m.gb) { ra.W++; ra.pts += 3; rb.L++; }
    else if (m.ga < m.gb) { rb.W++; rb.pts += 3; ra.L++; }
    else { ra.D++; rb.D++; ra.pts++; rb.pts++; }
  }

  // Ordena e atribui rank (1..n) às linhas de um grupo. Desempate por seed (estável).
  function rankGroupRows(rows, baseSeed) {
    rows.forEach(rw => { rw.gd = rw.gf - rw.ga; });
    rows.sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      seedFor(baseSeed, 'tb' + a.pid) - seedFor(baseSeed, 'tb' + b.pid));
    rows.forEach((rw, i) => { rw.rank = i + 1; });
    return rows;
  }

  // Qualificados na ordem do chaveamento. groups[i].table = rows ordenadas (com .rank).
  function koSeedingAlive(size, groups, byId) {
    const seeding = KO_SEEDING[size];
    return seeding.map(([gi, rank]) => byId[groups[gi].table[rank].pid]);
  }

  // Metadados (id/label) da rodada de mata-mata conforme nº de classificados restantes.
  function koRoundMeta(entrants) {
    return entrants >= 8 ? { id: 'qf', label: 'Quartas de Final' }
      : entrants === 4 ? { id: 'sf', label: 'Semifinal' }
      : { id: 'final', label: 'Final' };
  }

  // Versão "magra" dos participantes (para enviar ao client / render do bracket).
  function slimParticipants(participants) {
    return participants.map(p => ({
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
  }

  // Monta a lista de participantes (humanos + bots) com stats e índice por id.
  function buildParticipants(humanParticipants, opts) {
    opts = opts || {};
    const size = opts.bracketSize || bracketSizeFor(Math.max(humanParticipants.length, 2));
    const baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : E.generateSeed();

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
    return { participants, byId, size, baseSeed };
  }

  // Embaralha e distribui os participantes em grupos de 4 (determinístico).
  // Retorna [{ name, members:[participant] }].
  function drawGroups(participants, baseSeed, size) {
    const order = [...participants];
    const shuf = E.mulberry32(seedFor(baseSeed, 'groups'));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuf() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const numGroups = size / 4;
    const groups = [];
    for (let g = 0; g < numGroups; g++) {
      groups.push({ name: GROUP_NAMES[g], members: order.slice(g * 4, g * 4 + 4) });
    }
    return groups;
  }

  // ════════════════════════════════════════════════════════════
  //  BUILD BRACKET (estrutura sem jogar) — para o driver interativo
  // ════════════════════════════════════════════════════════════
  // Retorna participantes + grupos com tabela zerada e os pares de jogos (RR4),
  // sem simular nada. O driver (client/server) joga partida a partida e usa os
  // helpers acima (applyGroupResult, rankGroupRows, koSeedingAlive, koRoundMeta).
  function buildBracket(humanParticipants, opts) {
    const { participants, byId, size, baseSeed } = buildParticipants(humanParticipants, opts);
    const draw = drawGroups(participants, baseSeed, size);
    const groups = draw.map(g => {
      const table = {};
      g.members.forEach(m => { table[m.id] = emptyRow(m.id); });
      const matchPairs = RR4.map(([x, y]) => [g.members[x].id, g.members[y].id]);
      return { name: g.name, members: g.members, table, matchPairs, matches: [] };
    });
    return { participants, byId, size, baseSeed, groups };
  }

  // ════════════════════════════════════════════════════════════
  //  RUN TOURNAMENT (simula tudo de uma vez — modos clássicos)
  // ════════════════════════════════════════════════════════════
  // runTournament(humanParticipants, opts)
  //   humanParticipants: [{ id, name, isBot, flag, team:{players,slots,tactic,captainId,penaltyOrder} }]
  //   opts: { bracketSize?, seed?, minAvgOverall? }
  function runTournament(humanParticipants, opts) {
    const { participants, byId, size, baseSeed } = buildParticipants(humanParticipants, opts);
    const draw = drawGroups(participants, baseSeed, size);

    // Fase de grupos
    const groups = [];
    for (let g = 0; g < draw.length; g++) {
      const members = draw[g].members;
      const table = {};
      members.forEach(m => { table[m.id] = emptyRow(m.id); });
      const matches = [];
      for (const [x, y] of RR4) {
        const r = playMatch(members[x], members[y], baseSeed, `g${g}-${x}${y}`, false);
        matches.push(r);
        applyGroupResult(table, r);
      }
      const rows = rankGroupRows(members.map(m => table[m.id]), baseSeed);
      groups.push({ name: draw[g].name, table: rows, matches });
    }

    // Mata-mata
    let alive = koSeedingAlive(size, groups, byId);
    const rounds = [];
    while (alive.length >= 2) {
      const meta = koRoundMeta(alive.length);
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

    return {
      bracketSize: size,
      champion,
      participants: slimParticipants(participants),
      groups: groups.map(g => ({ name: g.name, table: g.table, matches: g.matches })),
      knockout: { rounds },
      seed: baseSeed,
    };
  }

  return {
    runTournament, bracketSizeFor, buildBotTeam, pickBotSquads,
    // Para o driver interativo:
    buildBracket, buildParticipants, drawGroups, playMatch,
    applyGroupResult, rankGroupRows, koSeedingAlive, koRoundMeta, slimParticipants,
    emptyRow, seedFor, RR4, KO_SEEDING, GROUP_NAMES, teamStats,
  };
});
