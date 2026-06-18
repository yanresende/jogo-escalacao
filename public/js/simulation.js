/* ============================================================
   7a0 — Motor de Simulação
   ------------------------------------------------------------
   O núcleo foi extraído para `engine.js` (compartilhado com o
   server). Este arquivo permanece por compatibilidade da ordem
   de scripts e expõe aliases legados quando necessário.

   Globais disponíveis (via engine.js): mulberry32, poisson,
   calcTeamStats, calcChemistry, simulateTournament, simulateVersus,
   generateSeed, encodeTeam, decodeTeam, STAGE_CONFIG, TACTICS,
   PLAY_STYLES, getStyle, ACHIEVEMENTS, evaluateAchievements, ...
   ============================================================ */

// Alias legado: alguns trechos antigos referenciavam este nome.
if (typeof simulateMultiplayerMatchClient === 'undefined') {
  function simulateMultiplayerMatchClient(playersA, playersB, seed) {
    const r = simulateVersus({ players: playersA }, { players: playersB }, seed);
    return {
      goalsA: r.goalsA, goalsB: r.goalsB,
      statsA: r.statsA, statsB: r.statsB,
      eventsA: r.eventsA, eventsB: r.eventsB,
    };
  }
}
