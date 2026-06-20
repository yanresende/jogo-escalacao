/* ============================================================
   7a0 — Motor de Eventos Interativos (compartilhado client + server)
   "Pedra-papel-tesoura" temático de futebol: atacante e defensor
   escolhem 1 de 3 ações (escolha secreta/simultânea). A matriz de
   vantagem + razão de overalls decide gol / defesa / lance neutro.
   Consequências de PARTIDA (não persistem): Momentum, Cartão vermelho,
   Fôlego (stamina). Inclui pênaltis interativos (L/M/R).

   Padrão UMD: no browser usa os globais do engine (Object.assign em
   window); no Node, require('./engine.js'). Lógica pura, sem DOM,
   determinística por seed.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./engine.js')); // Node (server.js)
  } else {
    root.Events = factory(root);                      // Browser (engine em window)
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const clamp = E.clamp || ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));

  // ════════════════════════════════════════════════════════════
  //  AÇÕES (3 do atacante, 3 do defensor) + MATRIZ DE VANTAGEM
  // ════════════════════════════════════════════════════════════
  // staminaCost: custo de fôlego ao executar a ação. aggressive: pode dar
  // cartão vermelho em falha crítica.
  const ATK_ACTIONS = {
    lancamento: { key: 'lancamento', label: 'Lançamento',  emoji: '🎯', staminaCost: 9, desc: 'Bola enfiada nas costas da defesa' },
    drible:     { key: 'drible',     label: 'Drible',       emoji: '🪄', staminaCost: 8, desc: 'Talento individual no um-contra-um' },
    cruzamento: { key: 'cruzamento', label: 'Cruzamento',   emoji: '↗️', staminaCost: 6, desc: 'Bola na área pela jogada de lado' },
  };
  const DEF_ACTIONS = {
    impedimento: { key: 'impedimento', label: 'Linha de Impedimento', emoji: '🚩', staminaCost: 5, desc: 'Adianta a linha p/ pegar impedimento' },
    marcacao:    { key: 'marcacao',    label: 'Marcação',             emoji: '🧤', staminaCost: 6, desc: 'Marcação individual firme' },
    carrinho:    { key: 'carrinho',    label: 'Carrinho Forte',       emoji: '🦵', staminaCost: 9, desc: 'Dividida agressiva (risco de vermelho)', aggressive: true },
  };

  // Ciclo (cada ação do atacante vence exatamente uma do defensor):
  //   lancamento  vence impedimento  (bola enfiada fura a linha alta)
  //   drible      vence carrinho      (passa pela dividida)
  //   cruzamento  vence marcacao      (cruzamento supera a marcação individual)
  // ma = multiplicador do atacante; md = do defensor. >1 favorece, <1 prejudica.
  const ADV_WIN  = { ma: 1.35, md: 0.72 }; // atacante leva a melhor
  const ADV_LOSE = { ma: 0.70, md: 1.40 }; // defensor leva a melhor
  const ADV_NEU  = { ma: 1.00, md: 1.00 }; // lance neutro

  const ADVANTAGE_MATRIX = {
    lancamento: { impedimento: ADV_WIN,  marcacao: ADV_LOSE, carrinho: ADV_NEU  },
    drible:     { impedimento: ADV_LOSE, marcacao: ADV_NEU,  carrinho: ADV_WIN  },
    cruzamento: { impedimento: ADV_NEU,  marcacao: ADV_WIN,  carrinho: ADV_LOSE },
  };

  // ── Constantes de regra (do pedido) ─────────────────────────
  const STAMINA_START      = 100;
  const STAMINA_LOW        = 30;   // gatilho de penalidade
  const STAMINA_DRAIN_MIN  = 0.30; // desgaste passivo por minuto
  const LATE_MINUTE        = 75;   // "minutos finais"
  const MOMENTUM_MINUTES   = 15;   // duração do buff (tempo de jogo)
  const MOMENTUM_BONUS     = 0.05; // +5%
  const STAMINA_PENALTY    = 0.85; // multiplicador quando fôlego baixo no fim
  const RED_PENALTY        = 0.07; // -7% de eficácia por expulsão
  const CRIT_FAIL_PROB     = 0.14; // chance de vermelho ao usar ação agressiva
  const DIRECTIONS = ['esquerda', 'meio', 'direita'];

  // ════════════════════════════════════════════════════════════
  //  ESTADO DA PARTIDA
  // ════════════════════════════════════════════════════════════
  // teamA/teamB: { players, slots?, tactic?, captainId?, name?, flag? }
  // opts: { eventCount, seed }
  function newMatchState(teamA, teamB, opts) {
    opts = opts || {};
    const statsA = E.calcTeamStats(teamA.players, { tactic: teamA.tactic, captainId: teamA.captainId, slots: teamA.slots });
    const statsB = E.calcTeamStats(teamB.players, { tactic: teamB.tactic, captainId: teamB.captainId, slots: teamB.slots });
    const eventCount = clamp(opts.eventCount || 4, 1, 12);
    const seed = (opts.seed != null ? opts.seed : E.generateSeed()) >>> 0;
    return {
      teamA, teamB, statsA, statsB,
      staminaA: STAMINA_START, staminaB: STAMINA_START,
      momentumA: 0, momentumB: 0,   // minuto-limite do buff (0 = inativo)
      redA: 0, redB: 0,             // nº de expulsões
      scoreA: 0, scoreB: 0,
      clock: 0,
      eventCount,
      eventMinutes: scheduleEventMinutes(eventCount, seed),
      seed,
    };
  }

  // Distribui `count` minutos de evento entre 8' e 86' (sem repetir).
  function scheduleEventMinutes(count, seed) {
    const rng = E.mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const set = new Set();
    let guard = 0;
    while (set.size < count && guard++ < 500) {
      set.add(8 + Math.floor(rng() * 79)); // 8..86
    }
    return [...set].sort((a, b) => a - b);
  }

  // ── Modificadores de eficácia (momentum / stamina / vermelho) ─
  function momentumActive(ms, side) {
    return (side === 'a' ? ms.momentumA : ms.momentumB) > ms.clock;
  }
  function teamModifier(ms, side) {
    let f = 1;
    if (momentumActive(ms, side)) f *= (1 + MOMENTUM_BONUS);
    const stamina = side === 'a' ? ms.staminaA : ms.staminaB;
    if (ms.clock >= LATE_MINUTE && stamina < STAMINA_LOW) f *= STAMINA_PENALTY;
    const red = side === 'a' ? ms.redA : ms.redB;
    if (red > 0) f *= Math.max(0.6, 1 - red * RED_PENALTY);
    return f;
  }
  function effAttack(ms, side) {
    return (side === 'a' ? ms.statsA.attack : ms.statsB.attack) * teamModifier(ms, side);
  }
  function effDefense(ms, side) {
    return (side === 'a' ? ms.statsA.defense : ms.statsB.defense) * teamModifier(ms, side);
  }
  function spendStamina(ms, side, amount) {
    if (side === 'a') ms.staminaA = clamp(ms.staminaA - amount, 0, 100);
    else ms.staminaB = clamp(ms.staminaB - amount, 0, 100);
  }
  function grantMomentum(ms, side) {
    const until = ms.clock + MOMENTUM_MINUTES;
    if (side === 'a') ms.momentumA = until; else ms.momentumB = until;
  }

  // ════════════════════════════════════════════════════════════
  //  RESOLUÇÃO DE UM EVENTO
  // ════════════════════════════════════════════════════════════
  // resolveEvent(ms, atkSide, atkKey, defKey, rng) → desfecho + efeitos
  //   atkSide: 'a' | 'b' (quem ataca). rng: função [0,1).
  function resolveEvent(ms, atkSide, atkKey, defKey, rng) {
    const defSide = atkSide === 'a' ? 'b' : 'a';
    const atkAction = ATK_ACTIONS[atkKey] || ATK_ACTIONS.cruzamento;
    const defAction = DEF_ACTIONS[defKey] || DEF_ACTIONS.marcacao;
    const adv = (ADVANTAGE_MATRIX[atkAction.key] && ADVANTAGE_MATRIX[atkAction.key][defAction.key]) || ADV_NEU;

    // Custo de fôlego de cada lado
    spendStamina(ms, atkSide, atkAction.staminaCost);
    spendStamina(ms, defSide, defAction.staminaCost);

    // Cartão vermelho: ação agressiva do defensor pode dar falha crítica
    let redCard = null;
    if (defAction.aggressive && rng() < CRIT_FAIL_PROB) {
      if (defSide === 'a') ms.redA++; else ms.redB++;
      redCard = { side: defSide };
    }

    // Razão de overalls (com multiplicadores da matriz) → prob. de gol
    const a = effAttack(ms, atkSide) * adv.ma;
    const d = effDefense(ms, defSide) * adv.md;
    const pGoal = clamp(a / (a + d), 0.05, 0.95);

    let outcome;
    const roll = rng();
    if (roll < pGoal) {
      outcome = 'goal';
      if (atkSide === 'a') ms.scoreA++; else ms.scoreB++;
    } else {
      // Não foi gol: defesa (mais provável quando o defensor leva vantagem) ou lance neutro/perdido.
      const saveShare = clamp(0.45 + (adv.md - adv.ma) * 0.45, 0.2, 0.85);
      outcome = rng() < saveShare ? 'save' : 'neutral';
    }

    // Momentum por jogada "brilhante" (vencer a matriz e concretizar).
    let momentumGranted = null;
    if (outcome === 'goal' && adv.ma > adv.md) { grantMomentum(ms, atkSide); momentumGranted = { side: atkSide }; }
    else if (outcome === 'save' && adv.md > adv.ma) { grantMomentum(ms, defSide); momentumGranted = { side: defSide }; }

    // Autor do gol (para o feed)
    let scorer = null;
    if (outcome === 'goal') {
      const team = atkSide === 'a' ? ms.teamA : ms.teamB;
      scorer = E.pickGoalScorer(team.players, rng);
    }

    return {
      atkSide, defSide, atkAction: atkAction.key, defAction: defAction.key, adv,
      outcome, pGoal, scorer, redCard, momentumGranted,
      scoreA: ms.scoreA, scoreB: ms.scoreB,
      staminaA: ms.staminaA, staminaB: ms.staminaB,
      momentumA: ms.momentumA, momentumB: ms.momentumB,
      redA: ms.redA, redB: ms.redB,
    };
  }

  // ════════════════════════════════════════════════════════════
  //  SIMULAÇÃO DE FUNDO (gols Poisson nos minutos sem evento)
  // ════════════════════════════════════════════════════════════
  // Mantém a partida viva entre os lances; calibrado p/ ~0.7 gol/time/jogo,
  // bem abaixo dos eventos, para as escolhas continuarem pesando.
  const BG_BASE = 0.0085; // prob/min base de gol por time
  function backgroundGoalChance(ms, side) {
    const atk = effAttack(ms, side);
    const def = effDefense(ms, side === 'a' ? 'b' : 'a');
    return clamp(BG_BASE * (atk / Math.max(def, 1)), 0, 0.05);
  }
  // Avança 1 minuto: desgaste passivo + chance de gol de fundo p/ cada lado.
  // Retorna lista de gols ocorridos: [{ side, scorer, minute }].
  function applyBackgroundMinute(ms, rng) {
    ms.clock++;
    spendStamina(ms, 'a', STAMINA_DRAIN_MIN);
    spendStamina(ms, 'b', STAMINA_DRAIN_MIN);
    const goals = [];
    for (const side of ['a', 'b']) {
      if (rng() < backgroundGoalChance(ms, side)) {
        const team = side === 'a' ? ms.teamA : ms.teamB;
        if (side === 'a') ms.scoreA++; else ms.scoreB++;
        goals.push({ side, scorer: E.pickGoalScorer(team.players, rng), minute: ms.clock });
      }
    }
    return goals;
  }

  // ── Quem ataca no próximo lance (ponderado pelo ataque efetivo) ─
  function pickAttackingSide(ms, rng) {
    const a = effAttack(ms, 'a'), b = effAttack(ms, 'b');
    return rng() < a / (a + b) ? 'a' : 'b';
  }

  // ── IA: escolha de ação para bots e p/ humano AFK (timeout) ───
  // role: 'attacker' | 'defender'. Leve preferência por ações de menor custo
  // quando o fôlego está baixo; senão quase uniforme.
  function botChooseAction(ms, role, side, rng) {
    const keys = role === 'attacker' ? Object.keys(ATK_ACTIONS) : Object.keys(DEF_ACTIONS);
    const actions = role === 'attacker' ? ATK_ACTIONS : DEF_ACTIONS;
    const stamina = side === 'a' ? ms.staminaA : ms.staminaB;
    const low = stamina < 40;
    const weights = keys.map(k => {
      let w = 1;
      if (low) w += (12 - actions[k].staminaCost) * 0.18; // poupa fôlego
      if (actions[k].aggressive && stamina < STAMINA_LOW) w *= 0.4; // evita risco c/ time cansado
      return Math.max(0.05, w);
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) return keys[i]; }
    return keys[keys.length - 1];
  }

  // ════════════════════════════════════════════════════════════
  //  PÊNALTIS INTERATIVOS (L / M / R)
  // ════════════════════════════════════════════════════════════
  // Cobrador escolhe direção; goleiro escolhe onde defender.
  // Mesmo lado → defesa provável (modulada por habilidade do cobrador vs goleiro);
  // lados diferentes → gol provável com pequena chance de erro.
  const penaltySkill = E.penaltySkill || (p => p.overall);
  function resolvePenaltyKick(kicker, keeper, kickDir, diveDir, rng) {
    const skill = penaltySkill(kicker);
    const gkOv = keeper ? keeper.overall : 70;
    if (kickDir === diveDir) {
      const scoreProb = clamp(0.30 + (skill - gkOv) * 0.006, 0.08, 0.55);
      return rng() < scoreProb
        ? { result: 'goal', goal: true, kickDir, diveDir }
        : { result: 'save', goal: false, kickDir, diveDir };
    }
    const scoreProb = clamp(0.88 + (skill - gkOv) * 0.004, 0.62, 0.97);
    return rng() < scoreProb
      ? { result: 'goal', goal: true, kickDir, diveDir }
      : { result: 'miss', goal: false, kickDir, diveDir };
  }

  // Goleiro/cobrador IA: escolhe direção. Leve viés do goleiro por "ler" cobradores fracos.
  function botChooseDirection(rng) {
    return DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
  }

  // Ordem de cobradores: reusa a escolhida pelo usuário + resto por habilidade.
  function penaltyOrderFor(team) {
    const players = team.players || [];
    const byId = {}; players.forEach(p => { byId[p.id] = p; });
    const chosen = (team.penaltyOrder || []).map(id => byId[id]).filter(Boolean);
    const seen = new Set(chosen.map(p => p.id));
    const rest = players.filter(p => !seen.has(p.id)).sort((x, y) => penaltySkill(y) - penaltySkill(x));
    return chosen.concat(rest);
  }
  function findGoalkeeper(team) {
    const players = team.players || [];
    return players.find(p => p.position === 'gol')
      || players.reduce((lo, p) => (!lo || p.overall < lo.overall ? p : lo), null);
  }

  return {
    ATK_ACTIONS, DEF_ACTIONS, ADVANTAGE_MATRIX, DIRECTIONS,
    ADV_WIN, ADV_LOSE, ADV_NEU,
    STAMINA_START, STAMINA_LOW, STAMINA_DRAIN_MIN, LATE_MINUTE,
    MOMENTUM_MINUTES, MOMENTUM_BONUS, STAMINA_PENALTY, RED_PENALTY, CRIT_FAIL_PROB, BG_BASE,
    newMatchState, scheduleEventMinutes, resolveEvent,
    applyBackgroundMinute, backgroundGoalChance, pickAttackingSide, botChooseAction,
    teamModifier, momentumActive, effAttack, effDefense,
    resolvePenaltyKick, botChooseDirection, penaltyOrderFor, findGoalkeeper,
  };
});
