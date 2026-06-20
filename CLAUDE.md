# CLAUDE.md — 7a0 Sete a Zero

Clone do jogo viral brasileiro "7a0 — Sete a Zero" (Copa do Mundo 2026).
Draft de jogadores históricos por dados + **torneio formato Copa do Mundo** (grupos + mata-mata, com
pênaltis) simulado por distribuição de Poisson. Single-player contra bots (seleções reais) e
multiplayer até 16 jogadores via Socket.io — **mesmo motor de torneio** (`tournament.js`) nos dois.

## Como rodar

```bash
npm install          # só na primeira vez (inclui pg)
node server.js       # inicia em http://localhost:3000
```

Sem build step. Sem bundler. Sem framework. HTML/CSS/JS puro no client, Node.js no server.

**Banco de dados (opcional em dev):** se `DATABASE_URL` não estiver definido, o `db.js` usa um store
**em memória** (com aviso no console) — o app roda normalmente, mas o progresso não persiste.

## Deploy na Railway

1. Suba o repositório na Railway (detecta Node e roda `npm start`).
2. Adicione o plugin **PostgreSQL** — a Railway injeta `DATABASE_URL` automaticamente.
3. No boot, `db.init()` cria as tabelas (`profiles`, `daily_scores`) se não existirem.
4. Em produção a conexão usa SSL (`NODE_ENV=production`). A porta vem de `process.env.PORT`.

---

## Estrutura de arquivos

```
jogo/
├── server.js                  Node + Express + Socket.io + API REST (/api/*)
├── matchServer.js             Driver do MODO INTERATIVO no servidor (torneio ao vivo, rodada a rodada)
├── db.js                      Persistência: PostgreSQL (pg) com fallback em memória
├── package.json
└── public/                    Servido estaticamente pelo Express
    ├── index.html             SPA — todas as telas em um único arquivo
    ├── style.css              Dark theme + cards FUT, mobile-first
    └── js/
        ├── engine.js          Motor compartilhado (UMD): Poisson, química, táticas, pênaltis, conquistas
        ├── data.js            Banco de dados de jogadores + helpers (com export Node no fim)
        ├── tournament.js      Motor de torneio (UMD): grupos + mata-mata, bots; runTournament + buildBracket
        ├── events.js          Motor de EVENTOS interativos (UMD): RPS, momentum, stamina, vermelho, pênaltis L/M/R
        ├── simulation.js      Shim legado (núcleo migrou para engine.js)
        ├── game.js            Estado global + lógica de draft + restrições
        ├── profile.js         Perfil anônimo (uid no localStorage) + sync com backend
        ├── modes.js           Modos single-player + torneio local (clássico e interativo)
        ├── ui.js              Renderização DOM + cards + animações + bracket + ordem de pênaltis
        ├── match.js           Playback "ao vivo" (modos clássicos): scoreboard, relógio, gols
        ├── interactiveMatch.js Partida interativa no cliente: modal de decisão + board + pênaltis L/M/R
        └── multiplayer.js     Cliente Socket.io (lobby + torneio até 16 + duelos interativos ao vivo)
```

**Ordem de carregamento dos scripts** (declarada no `index.html`):
`engine.js` → `data.js` → `tournament.js` → `simulation.js` → `game.js` → `profile.js` → `modes.js` → `ui.js` → `match.js` → `events.js` → `interactiveMatch.js` → `socket.io.js` → `multiplayer.js`

Crítico: `engine.js` carrega **primeiro** (expõe globais via UMD `Object.assign(window, api)`).
`data.js` vem em seguida (expõe `PLAYERS`, `SQUAD_LIST`, etc.). `tournament.js` depende de ambos.
`server.js` faz `require('./public/js/engine.js')` e `require('./public/js/tournament.js')` para usar
a **mesma** matemática do client. `game.js` depende de globais de `engine.js`/`data.js`; `modes.js` e
`ui.js` dependem de `game.js`/`profile.js`/`tournament.js`; `multiplayer.js` por último. Se a ordem
mudar, quebra com "X is not defined".

> **Pegadinha UMD (`tournament.js`):** no browser, as funções do engine estão em `window` (via
> `Object.assign`), mas `SQUAD_LIST` é um `const` de topo em `data.js` — binding léxico global, **não**
> propriedade de `window`. Por isso o wrapper UMD passa `SQUAD_LIST`/`playerFitsSlot` **por nome** ao
> factory (não via `window.SQUAD_LIST`, que seria `undefined`).

## Motor compartilhado (`engine.js`)

Núcleo de simulação em padrão UMD (Node `module.exports` + browser globais). Principais exports:
`simulateTournament(players, seed, opts)`, `simulateVersus(teamA, teamB, seed)`,
`simulateShootout(teamA, teamB, seed)`, `penaltySkill(player)`, `calcChemistry`, `calcTeamStats`,
`TACTICS`, `PLAY_STYLES`/`getStyle`, `evaluateAchievements`/`ACHIEVEMENTS`, `mulberry32`,
`hashStringToSeed`, `encodeTeam`/`decodeTeam`. `opts = { tactic, captainId, slots, stages }`.

**Química por estilo:** cada jogador tem um campo opcional `style` no `data.js` (ver Posições/Estilos);
sem ele, `getStyle()` deriva por posição. Química = sinergia de estilos + alinhamento com a tática +
capitão. Alimenta o OVR efetivo usado em `calcTeamStats`.

### Disputa de pênaltis (`simulateShootout`)

Usada no **mata-mata** quando a partida empata (tanto no torneio solo quanto no multiplayer).
Decidida pela **qualidade** dos times, não por sorteio 50/50:

- `penaltySkill(p)` = `overall + PENALTY_POS_BONUS[posição]` (atacante +10 … zagueiro −7, goleiro −14).
- Prob. de gol de cada cobrança = `clamp(0.74 + (penaltySkill(cobrador) − overall do goleiro) × 0.011, 0.25, 0.96)`.
  Sobe com a habilidade do cobrador, desce com o goleiro adversário; o `rng()` é a aleatoriedade
  (azar/sorte). Quando não é gol, sorteia **defesa** (mais provável com goleiro bom) ou **para fora**.
- Ordem de batedores = `team.penaltyOrder` (escolhida pelo usuário) + resto por habilidade.
- **Melhor de 5** com parada antecipada; empate após 5 → **morte súbita** (1 cobrança p/ cada até
  alguém abrir vantagem). Determinístico pelo seed.
- Retorno: `{ a, b, kicks[], suddenDeath, winner:'a'|'b' }`. Cada `kick` tem
  `{ team, round, kicker, result:'goal'|'save'|'miss', scored, sa, sb }`.

## Motor de torneio (`tournament.js`)

UMD compartilhado client+server. **Mesmo formato Copa do Mundo no solo e no multiplayer** — a única
diferença é quem ocupa as vagas (bots no solo; humanos + bots no multiplayer).

`runTournament(humanParticipants, opts)` → roda grupos de 4 (round-robin) + mata-mata até a final,
usando `E.simulateVersus`/`E.simulateShootout` por partida. `opts = { bracketSize?, seed?, minAvgOverall? }`:
- `bracketSize`: 4 / 8 / 16. Default escala por nº de participantes (`bracketSizeFor`). Solo usa **16**.
- `seed`: torna o torneio determinístico (Diário usa `hashStringToSeed(data+':tour')` → mesmos bots/chave p/ todos).
- `minAvgOverall`: filtra seleções mais fortes (dificuldade da Carreira escala por rodada).

**Bots = seleções históricas reais.** `pickBotSquads` sorteia seleções distintas de `SQUAD_LIST`
(≥11 jogadores); `buildBotTeam` escala os 11 melhores numa formação viável (`BOT_FORMATIONS`) e
escolhe uma tática (`BOT_TACTICS`). Nome do bot = `país + ano` (ex: "Brasil 2006").

Vagas (16) preenchidas: 4 grupos de 4 → top 2 de cada (8) → quartas → semi → final. Cruzamento em
`KO_SEEDING`. Empate no grupo classifica; empate no mata-mata vai aos pênaltis.

**Payload de retorno:** `{ bracketSize, champion: pid, participants[], groups[], knockout:{rounds[]}, seed }`.
Cada `group` tem `table[]` (P/V/E/D/SG/Pts/rank) + `matches[]`. Cada `knockout.round` tem `matches[]`
com `{a, b, ga, gb, winner, pens? }`.

**Refator para o modo interativo:** `runTournament` foi quebrado em helpers reusáveis — `buildBracket`
(monta participantes + bots + sorteio de grupos **sem jogar**), `applyGroupResult`, `rankGroupRows`,
`koSeedingAlive`, `koRoundMeta`, `slimParticipants`, `playMatch`. O driver interativo (client e server)
joga partida a partida e remonta o **mesmo payload** acima. `runTournament` continua idêntico (usa os
helpers internamente) — não mexer no seu output, que os modos clássicos dependem dele.

## Modo Interativo (Eventos — pedra-papel-tesoura)

3ª opção na tela de modo (`#mode-interactive`, ⚔️) + disponível no multiplayer (host ativa no lobby).
`state.eventsMode` (bool) + `state.eventCount` (nº de lances por partida). Difere dos modos clássicos:
as partidas **do jogador** são jogadas **ao vivo, partida a partida** (o placar depende das escolhas),
em vez de pré-simuladas. **Todas** as partidas do jogador são interativas; gols vêm de **eventos + Poisson de fundo**.

**Motor puro (`events.js`, UMD compartilhado client+server):**
- `ATK_ACTIONS`/`DEF_ACTIONS` (3 cada) + `ADVANTAGE_MATRIX` em ciclo (Lançamento vence Linha de Impedimento,
  Drible vence Carrinho, Cruzamento vence Marcação) → multiplicadores `{ma, md}`.
- `resolveEvent(ms, atkSide, atkKey, defKey, rng)` → `pGoal = clamp((effAtk·ma)/(effAtk·ma + effDef·md), .05, .95)`,
  desfecho `goal|save|neutral`. Efeitos: **momentum** (+5% por 15 min de jogo), **cartão vermelho** (ação
  agressiva `carrinho` → falha crítica), **stamina** (100, ações custam fôlego, <30 nos minutos finais → penalidade).
- `newMatchState`, `scheduleEventMinutes`, `applyBackgroundMinute` (Poisson leve), `pickAttackingSide`,
  `botChooseAction` (IA p/ bots e humano AFK), `resolvePenaltyKick` (cobrador L/M/R vs goleiro).

**Solo (`interactiveMatch.js` + `runInteractiveTournament` em `modes.js`):** `buildBracket` → joga as
partidas do humano com `playInteractiveMatch` (modal de decisão + board + pênaltis L/M/R), bot×bot via
`Tournament.playMatch` instantâneo → remonta o payload e reusa `renderTournamentResult`/`humanResultShape`/`onTournamentComplete`.

**Multiplayer (`matchServer.js`, servidor autoritativo):** `createInteractiveDriver(io, room, humans, {eventCount})`
roda o torneio **rodada a rodada** (3 matchdays de grupo + KO), todas as partidas da rodada em paralelo
(cada humano em ≤1). Nos minutos de evento emite `event_prompt` (escolha secreta) aos humanos envolvidos
(timeout → IA), resolve e emite `event_result`; gols de fundo via `match_clock`. Empate no KO → `pen_prompt`.
Eventos socket: C→S `set_match_mode`/`event_choice`/`pen_choice`; S→C `match_start`/`match_clock`/`event_prompt`/
`event_result`/`pen_prompt`/`pen_result`/`match_end`/`round_phase` + `tournament_result` final (reusa o render).
Timings overrideáveis por env (`IM_TICK_MS`/`IM_REVEAL_MS`/`IM_PEN_MS`/`IM_TIMEOUT_MS`) para testes rápidos.

## Modos de jogo (`modes.js`)

`state.gameMode`: `'solo' | 'daily' | 'career' | 'survival'` (+ `'restrict'`).

**Solo, Diário, Carreira e Restrição rodam o torneio de bots** (`tournament.js`) localmente no client —
`isLocalTournamentMode()` em `game.js` retorna `true` para esses modos. Fluxo: draft → tática →
**ordem de pênaltis** → `runLocalTournament()` (em `modes.js`) → tela de **bracket**.

`runLocalTournament()` monta o participante humano de `state.slots` (+ tática, capitão, `penaltyOrder`),
preenche com 15 bots (chave 16) e chama `Tournament.runTournament([human], opts)`:
- **Solo:** seed aleatório.
- **Diário:** `opts.seed = hashStringToSeed(data+':tour')` → mesmos bots/chave p/ todos (ranking justo).
  O draft continua determinístico via `state.dailySeq` (consumido em `rollDice()`).
- **Carreira:** `opts.minAvgOverall = min(84, 70 + careerRound × 1.8)` → adversários mais fortes por rodada.
  `Profile` guarda `coins`/`careerRound`/`careerWins`.
- **Restrição:** `state.restrictions` (`budget`, `oneCountry`) checado em `pickPlayer`/`pickPlayerToSlot`
  via `canPickPlayer()` (vale no draft); a simulação é o torneio normal.

**Survival é a exceção:** mantém a campanha animada antiga (`simulateTournament` vs força crescente,
tela `simulation` + `animateSimulation`). `buildSurvivalStages()` gera fases infinitas.

`humanResultShape(result, pid)` converte o caminho do humano no torneio de volta para a "forma" antiga
de `simResult` (`results[]`, `champion`, `stats`, `stagesReached`, `chemistry`) para reaproveitar
conquistas, pontuação diária e moedas sem reescrever `onTournamentComplete`.

`onTournamentComplete(simResult)` (chamado no fim de `runLocalTournament` ou de `animateSimulation` no
Survival) faz recompensas, conquistas e submissão do ranking diário.

## API REST (`server.js` → `db.js`)

- `GET /api/profile/:uid` · `PUT /api/profile/:uid`
- `POST /api/daily` (upsert por `(date,uid)`, mantém o maior score) · `GET /api/daily/:date`

---

## Telas (State Machine)

O estado global `state.screen` controla qual tela está visível. A função `goTo(screenId)` é a única forma de navegar — ela remove a classe `active` de todas as `.screen` e adiciona no `#screen-{screenId}`.

```
menu
 ├── Solo/Diário/Carreira/Restrição:  menu → (mode) → formation → draft → tactics → penalties → bracket
 ├── Survival:                        menu → restrict → formation → draft → tactics → simulation → results
 └── Multiplayer:  menu → lobby → (host inicia) → formation → draft → tactics → penalties → waiting → bracket
```

`confirmTactics()` (ui.js) decide o destino: modos de torneio (multiplayer ou `isLocalTournamentMode()`)
vão para `penalties`; Survival vai para `simulation`. Após a ordem de pênaltis, `onPenaltiesConfirmed()`
envia ao servidor (multiplayer) ou roda `runLocalTournament()` (single-player).

IDs das telas no HTML (mapeiam direto para `goTo`):
- `menu`, `mode`, `formation`, `draft`, `tactics`, `penalties`, `simulation`, `results`
- `lobby`, `waiting`, `bracket`, `achievements`, `daily`, `career`, `restrict`

---

## Estado global (`game.js`)

```js
const state = {
  screen:        'menu',         // tela atual
  mode:          'classic',      // 'classic' | 'memory' (afeta só o draft)
  formation:     null,           // chave de FORMATIONS, ex: '4-3-3'
  slots:         [],             // [{ pos: 'ca', player: null | PlayerObj }]
  wildcards:     3,
  currentRoll:   null,           // { squad, players[] } — resultado do dado atual
  pickedPlayers: [],             // jogadores já escolhidos (espelho de slots com player)
  seed:          null,           // seed numérico gerado no initDraft
  tactic:        'equilibrada',  // chave de TACTICS (engine.js)
  captainId:     null,           // id do jogador capitão
  penaltyOrder:  null,           // ordem de batedores de pênalti (ids) — torneio
  gameMode:      'solo',         // 'solo' | 'daily' | 'career' | 'survival' | 'restrict'
  restrictions:  null,           // { budget?, oneCountry?, label } | null
  dailySeq:      null,           // sequência determinística de squads (modo diário)
  isMultiplayer: false,
  simResults:    null,           // retorno de runTournament() ou simulateTournament()
}
```

`state.slots` é o array canônico do time. Cada elemento tem `pos` (posição esperada) e `player` (null = vazio). A ordem dos slots segue exatamente a ordem declarada em `FORMATIONS[formation].slots`.

---

## Banco de dados (`data.js`)

### Estrutura de um jogador

```js
{
  id:           'pele-bra-70',   // string única — formato: nome-país-ano
  name:         'Pelé',
  country:      'Brasil',
  flag:         '🇧🇷',
  worldCup:     1970,            // número (ano da Copa)
  position:     'ca',           // posição primária (ver abaixo)
  altPositions: ['pe', 'pd'],   // posições secundárias (pode ser [])
  overall:      99,              // 60–99
}
```

### Posições válidas
Códigos em **português, minúsculo** (12 no total — batem com os rótulos das imagens de formação):
`gol`, `zag`, `le`, `ld`, `vol`, `mc`, `mei`, `me`, `md`, `pe`, `pd`, `ca`

(GOL = goleiro, ZAG = zagueiro, LE/LD = laterais esq./dir., VOL = volante, MC = meio-campo, MEI = meia,
ME/MD = meias esq./dir. de ala, PE/PD = pontas esq./dir., CA = centroavante.) Os rótulos exibidos na UI
vêm de `POS_LABELS` em `game.js`.

### Tiers de rating
| Tier | Faixa | Exemplos |
|------|-------|---------|
| S    | 95–99 | Pelé 70 (99), Maradona 86 (99), Messi 22 (99), Cruyff 74 (97) |
| A    | 90–94 | Ronaldo R9 98 (97), Zidane 98 (97), Ronaldinho 02 (94) |
| B    | 80–89 | Titulares regulares de grandes seleções |
| C    | <80   | Reservas, seleções menores |

A função `getTier(overall)` está em `data.js` e retorna `'S'`, `'A'`, `'B'` ou `'C'`. Usada para colorir o badge do jogador na UI.

### Índices derivados (gerados automaticamente em data.js)

- `WORLD_CUPS` — array ordenado de anos únicos
- `SQUADS` — objeto indexado por `"${worldCup}-${country}"` → `{ worldCup, country, flag, players[] }`
- `SQUAD_LIST` — `Object.values(SQUADS)` — lista usada no rollDice

### Compatibilidade de posições

`POS_COMPAT` em `data.js` define quais slots uma posição pode preencher:
```js
ca:  ['ca', 'pe', 'pd'],    // centroavante pode jogar nas pontas
mc:  ['mc', 'vol', 'mei', 'me', 'md'],
pe:  ['pe', 'me', 'ca'],
// etc.
```

A função `playerFitsSlot(player, slotPos)` usa esse mapa — recebe o **objeto** do jogador (ou só a
string de posição) e considera tanto `position` quanto `altPositions`. É chamada tanto no `rollDice`
quanto no `pickPlayer`. (Nota: `POS_COMPAT` existe como referência, mas o encaixe real é decidido por
`[position, ...altPositions].includes(slotPos)`.)

### Como adicionar jogadores

Adicione um objeto ao array `PLAYERS` em `data.js`. O ID deve ser único e seguir o padrão `nome-pais-ano`. Exemplo:

```js
{ id:"ronaldo-bra-94", name:"Ronaldo R9", country:"Brasil", flag:"🇧🇷", worldCup:1994, position:"ca", altPositions:["pe","pd"], overall:88 },
```

Os índices `SQUADS` e `SQUAD_LIST` são gerados automaticamente no carregamento — não precisa mexer neles.

---

## Formações (`game.js`)

### Estrutura de uma formação

```js
FORMATIONS['4-3-3'] = {
  slots: ['gol','le','zag','zag','ld','vol','mei','mc','pe','ca','pd'],
  desc:  'Balanceada e versátil',
}
```

A ordem dos slots é importante: define o índice de cada posição no array `state.slots` e, portanto, o índice no `FIELD_POSITIONS` que determina onde cada círculo aparece no campo visual.

### Posições no campo (`FIELD_POSITIONS`)

```js
FIELD_POSITIONS['4-3-3'] = [
  [90, 50],   // índice 0 → gol  (y=90%, x=50%)
  [73, 18],   // índice 1 → le
  ...
]
```

`y` = distância do topo (0 = ataque/beira do gol adversário, 100 = goleiro/base). `x` = distância da esquerda.

### Como adicionar uma nova formação

1. Adicione a entrada em `FORMATIONS` em `game.js` com o array `slots` de 11 posições
2. Adicione a entrada correspondente em `FIELD_POSITIONS` com 11 pares `[y, x]`
3. Pronto — `renderFormationGrid()` e `renderField()` são dinâmicos

---

## Motor de simulação (núcleo em `engine.js`)

> **Nota:** `simulation.js` é um shim legado; o núcleo abaixo vive em `engine.js`. `simulateTournament`
> (vs força crescente por fase) hoje só é usado pelo **Survival**. Os demais modos e o multiplayer usam
> `simulateVersus` (1×1 entre times reais) via `tournament.js`.

### PRNG determinístico (Mulberry32)

```js
function mulberry32(seed) → () => float [0,1)
```

Usado para tornar a simulação reproduzível dado o mesmo seed. O seed é gerado por `generateSeed()` = `(Date.now() ^ random * 0xFFFFFFFF) >>> 0`.

### Distribuição de Poisson

```js
function poisson(lambda, rng) → int
```

Algoritmo de inversão. Usado para simular gols por partida. Lambda mínimo de 0.1 para evitar loops infinitos.

### Cálculo das stats do time

```js
function calcTeamStats(players) → { attack, defense, overall }
```

Cada posição tem um peso de ataque e defesa (`WEIGHT_MAP` em `engine.js`). O ataque e defesa do time são médias ponderadas dos overalls dos jogadores multiplicados pelos pesos.

Pesos principais:
- ca: atk 1.0 / def 0.0
- gol: atk 0.0 / def 1.0
- zag: atk 0.0 / def 0.95
- mc: atk 0.5 / def 0.5
- mei: atk 0.75 / def 0.1

### Fórmulas de gols por partida

```
lambdaFor     = max(0.1, 1.4 + (teamAttack  - opponentStrength) × 0.08)
lambdaAgainst = max(0.1, 1.4 + (opponentStrength - teamDefense) × 0.08)
goalsFor     = poisson(lambdaFor)
goalsAgainst = poisson(lambdaAgainst)
```

### Força dos adversários por fase (`STAGE_CONFIG`)

```js
{ id:'group1', label:'Fase de Grupos — Jogo 1', strength: 68 }
{ id:'group2', label:'Fase de Grupos — Jogo 2', strength: 71 }
{ id:'group3', label:'Fase de Grupos — Jogo 3', strength: 74 }
{ id:'r16',    label:'Oitavas de Final',         strength: 79 }
{ id:'qf',     label:'Quartas de Final',         strength: 83 }
{ id:'sf',     label:'Semifinal',                strength: 87 }
{ id:'final',  label:'Final',                    strength: 91 }
```

Para alterar a dificuldade, mude os `strength` aqui. Para adicionar fases (ex: fase de grupos a mais), adicione entradas ao array.

### Regras de eliminação

- **Grupos** (`stage.id.startsWith('group')`): empate avança. Só perde se perder o jogo.
- **Knockouts** (resto): precisa vencer. Empate = eliminado.
- Se eliminado, as fases seguintes recebem `status: 'skipped'`.

### Retorno de `simulateTournament(players, seed)`

```js
{
  results: [   // 7 objetos, um por fase
    {
      id, label, strength,     // da STAGE_CONFIG
      goalsFor, goalsAgainst,  // null se 'skipped'
      win, draw, advanced,
      status: 'win' | 'loss' | 'skipped'
    }
  ],
  stats:         { attack, defense, overall },  // stats calculadas do time
  champion:      boolean,                       // ganhou a final?
  stagesReached: number,                        // quantas fases jogou
  seed:          number,
}
```

---

## Draft (`game.js`)

### Fluxo de uma rodada de draft

1. Usuário clica no dado → `onDiceClick()` → `rollDice()`
2. `rollDice()` filtra `SQUAD_LIST` para squads que tenham ao menos 1 jogador compatível com as posições abertas
3. Sorteia 1 squad aleatório, filtra os jogadores daquele squad para posições abertas
4. Armazena em `state.currentRoll` e chama `renderDraftPick(roll)`
5. Usuário clica num jogador → `pickPlayer(playerId)` → preenche o melhor slot disponível
6. `renderField()` redesenha o campo; se `isDraftComplete()` → avança para simulação

### Lógica do `pickPlayer`

Rejeita jogador **já escalado** (`state.slots.some(s => s.player?.id === id)`) — sem isso, o mesmo
jogador poderia ocupar dois slots. Depois tenta encaixe exato (posição do jogador == posição do slot);
se não houver, usa qualquer slot aberto onde `playerFitsSlot` retorne true (evita desperdiçar um ca num
slot de gol). `pickPlayerToSlot` aplica a mesma dedup. No painel de draft, jogadores já escalados ou
incompatíveis aparecem como `.incompatible` (sem clique).

### Wildcards

`state.wildcards` começa em 3. `useWildcard()` decrementa e limpa `state.currentRoll`. O botão wildcard só fica habilitado quando há um roll ativo E wildcards > 0.

---

## UI e Renderização (`ui.js`)

### Funções principais

| Função | O que faz |
|--------|-----------|
| `renderFormationGrid()` | Monta os cards de formação dinamicamente de `FORMATIONS` |
| `renderDraftScreen()` | Setup inicial da tela de draft (badge, modo, wildcards) |
| `renderField()` | Redesenha todos os slots do campo. Chamada após cada pick. |
| `renderDraftPick(roll)` | Mostra a lista de jogadores da rolagem atual |
| `hideDraftPick()` | Esconde a lista, mostra o dado novamente |
| `renderWildcards()` | Atualiza os 3 ícones ⚡ (risca os usados) |
| `renderSimulation()` | Monta a tela de preview do time + stage cards vazios (Survival) |
| `animateSimulation(result)` | Revela os resultados fase a fase, 600ms por fase (Survival) |
| `renderResults(result, players)` | Preenche a tela de resultados finais (Survival) |
| `renderTactics()` / `confirmTactics()` | Tela de tática + capitão; roteia p/ pênaltis ou simulação |
| `renderPenaltyOrder()` | Tela de ordem de batedores (setas ▲▼, "Auto" por habilidade) |
| `renderTournamentResult(data)` | Tela de bracket: campeão, "seu caminho", grupos, mata-mata, pênaltis |
| `renderLobbyRoster(data, myId)` | Lista de jogadores na sala + botão "Iniciar" (host) |
| `showToast(msg)` | Exibe notificação temporária por 3 segundos |

### Responsividade do campo

O campo usa `position: relative` e cada slot usa `position: absolute; left: X%; top: Y%`. Percentuais vêm de `FIELD_POSITIONS`. Funciona em qualquer tamanho de tela sem JS extra.

### Modo Clássico vs. De Memória

`state.mode` é verificado em `renderDraftPick` e `renderField` para decidir se mostra o overall ou `'?'`. Não há lógica separada — é puramente visual.

### Animação do torneio

`animateSimulation` oculta o botão "Simular", espera 300ms, depois revela cada fase com 600ms de intervalo. Ao final, chama `renderResults` e navega para `results`. O `btn-simulate` tem seu listener adicionado em `ui.js` (não em `game.js` — ver armadilha abaixo).

---

## Multiplayer (`multiplayer.js` + `server.js`)

Torneio formato Copa do Mundo para **até 16 jogadores**. O host cria a sala, jogadores entram com
apelido, o host inicia (mín. 2). Vagas restantes da chave viram **bots**. Cada jogador monta **um time**
e o servidor simula o **torneio inteiro de uma vez** quando todos os times chegam — cada jogador
percorre seu próprio caminho (um pode chegar à final enquanto outro cai nos grupos).

### Estrutura de salas no servidor

```js
rooms = Map<roomCode, {
  hostId, started, finished,
  members: [{ id (socketId), name, team|null, connected }],   // até 16
  draftTimer: Timer|null, cleanupTimer: Timer|null,
}>
```

`socket.data.roomCode` guarda a sala de cada conexão. Tamanho da chave (4/8/16) escala pelo nº de
membros (`tournament.bracketSizeFor`).

### Eventos Socket.io

**Client → Server:**
| Evento | Payload | Resposta (callback) |
|--------|---------|---------------------|
| `create_room` | `name` | `{ roomCode }` |
| `join_room` | `code, name` | `{ ok }` ou `{ error }` |
| `start_tournament` | — (só host, ≥2) | `{ ok }` ou `{ error }` |
| `draft_complete` | `{ players, slots, tactic, captainId, penaltyOrder }` | — |

**Server → Client:**
| Evento | Payload | Quando |
|--------|---------|--------|
| `lobby_update` | `{ roomCode, hostId, started, count, max, players[] }` | Entrou/saiu alguém |
| `tournament_starting` | `{ bracketSize, count }` | Host iniciou → clientes vão à formação |
| `opponent_ready` | `{ name }` | Um jogador terminou o draft |
| `tournament_result` | resultado de `runTournament` + `youId` | Todos draftaram (ou deadline) |

### Simulação no servidor

`finishTournament(room)` monta os participantes humanos (times com 11 jogadores) e chama
`tournament.runTournament(humans)` (que completa com bots). O payload é emitido **por socket** com
`youId` próprio de cada um, para o cliente destacar o caminho do jogador. O torneio só inicia quando
**todos os conectados** enviam o time (`maybeFinish`). Há um **deadline de segurança**
(`DRAFT_DEADLINE_MS`, 5 min) só para não travar a sala se alguém ficar AFK: ao estourar, quem não
enviou o time perde a vaga (vira bot).

### Cliente

`multiplayer.js` mantém o lobby (roster via `renderLobbyRoster`), o botão "Iniciar" (só host),
`sendDraftComplete()` (envia o time + `penaltyOrder`, vai p/ `waiting`) e, ao receber
`tournament_result`, chama `renderTournamentResult` → tela `bracket`.

### Cleanup de salas

- Após `tournament_result`: sala deletada em 5 minutos (`cleanupTimer`).
- `disconnect` antes de iniciar: remove o membro, reatribui host, `lobby_update`.
- `disconnect` depois de iniciar: mantém o time já enviado; encerra se os restantes já draftaram.

---

## Share Team (URL code)

`encodeTeam(players)` → `btoa(ids.join(','))` → parâmetro `?team=` na URL

`decodeTeam(code)` → `atob(code).split(',')` → mapeia IDs de volta para objetos de `PLAYERS`

No `DOMContentLoaded` do `game.js`, `loadTeamFromURL()` é chamado antes de qualquer outra coisa. Se encontrar `?team=`, carrega o time, renderiza a tela de simulação e para (não mostra o menu).

---

## CSS e Variáveis

Todas as cores ficam em `:root` em `style.css`:
```css
--bg, --bg2, --bg3   /* fundos escuros em camadas */
--border             /* bordas sutis */
--accent             /* verde #22c55e — cor principal */
--gold               /* dourado #f59e0b — ratings S-tier */
--red                /* vermelho #ef4444 — derrota/erro */
--blue               /* azul #3b82f6 — informativo */
--text, --text2, --text3   /* branco → cinza claro → cinza escuro */
```

Classes de tier para os badges dos jogadores: `.tier-S`, `.tier-A`, `.tier-B`, `.tier-C`
Definidas em `style.css` na seção `── Draft Pick Panel ──`.

---

## Armadilhas e pontos de atenção

### 1. Listener duplicado no `btn-simulate`
O `game.js` NÃO adiciona listener no `btn-simulate` (está comentado). Só o `ui.js` adiciona, na sua própria `DOMContentLoaded`. Se por acidente o listener for adicionado nos dois, a simulação roda duas vezes e o jogo avança direto para resultados sem animação.

### 2. Ordem dos scripts importa
`engine.js` expõe a matemática como globais (`Object.assign(window, …)`). `data.js` expõe `PLAYERS`,
`SQUAD_LIST`, `POS_COMPAT`, `getTier`, `playerFitsSlot`. `tournament.js` expõe `window.Tournament`
(usa engine + data). `game.js` expõe `state`, `FORMATIONS`, `FIELD_POSITIONS`, `isLocalTournamentMode`.
Se a ordem for alterada no `index.html`, o jogo quebra com "X is not defined". Ver também a **pegadinha
UMD do `tournament.js`** na seção de estrutura de arquivos.

### 3. Fluxo do fim do draft (tática → pênaltis → torneio)
Quando o draft completa, `ui.js` vai para `tactics`. `confirmTactics()` então decide: modos de torneio
(multiplayer ou `isLocalTournamentMode()`) vão para a tela `penalties`; Survival vai para `simulation`.
`onPenaltiesConfirmed()` (ui.js) chama `sendDraftComplete()` (multiplayer, global de `multiplayer.js`)
ou `runLocalTournament()` (single-player, global de `modes.js`). Esse acoplamento por globais quebra se
algum desses arquivos virar módulo ES.

### 4. `state.pickedPlayers` vs `state.slots`
`state.slots` é a fonte da verdade — 11 objetos `{pos, player}`. `state.pickedPlayers` é uma lista auxiliar de jogadores escolhidos, usada em `calcTeamStats` e em algumas verificações. Ao resetar o jogo (`onPlayAgain`), ambos precisam ser limpos.

### 5. Posição "ativa" no campo
Em `renderField()`, o slot "ativo" (pulsando dourado) é o primeiro slot aberto: `openPositions[0]`. Isso pode ser confuso se o usuário tiver slots abertos em várias posições — o highlight vai sempre para o primeiro da lista `FORMATIONS[formation].slots`.

### 6. `loadTeamFromURL` usa formação fixa
Quando um time é carregado via URL (`?team=`), a formação usada é sempre `'4-3-3'` (hard-coded). Os jogadores são atribuídos na ordem dos índices do array, independente das posições originais. Para corrigir isso, seria necessário encodar a formação junto com os IDs.

---

## Tarefas comuns

### Adicionar jogador
Adicione no array `PLAYERS` em `public/js/data.js`. ID único, posição válida, worldCup numérico.

### Mudar força dos adversários (Survival)
Edite os valores `strength` em `STAGE_CONFIG` em `engine.js`. Só afeta o Survival/campanha legada.

### Mudar dificuldade da Carreira
Ajuste `opts.minAvgOverall` em `runLocalTournament()` (`modes.js`) — escala por `careerRound`.

### Mudar a matemática dos pênaltis
`PENALTY_POS_BONUS` (bônus por posição) e a constante `0.011` em `penaltyConvProb` (`engine.js`)
controlam o peso da qualidade vs. sorte. Limites em `clamp(..., 0.25, 0.96)`.

### Mudar tamanho/seed do torneio
`runTournament(humans, { bracketSize, seed, minAvgOverall })` em `tournament.js`. Solo usa
`bracketSize: 16`; Diário passa `seed` determinístico. Cruzamentos do mata-mata em `KO_SEEDING`.

### Mudar tempo da animação
Em `animateSimulation()` em `ui.js`, o `setTimeout(showNext, 600)` controla o delay entre fases. O `setTimeout(..., 300)` inicial é o delay antes da primeira fase aparecer.

### Adicionar nova formação
1. Objeto em `FORMATIONS` em `game.js` (11 slots)
2. Array de 11 `[y, x]` em `FIELD_POSITIONS` em `game.js`

### Mudar cor do accent
Altere `--accent` e `--accent2` em `:root` no `style.css`.

### Mudar porta do servidor
`PORT` em `server.js` lê `process.env.PORT || 3000`. Passe `PORT=8080 node server.js` ou edite o fallback.
