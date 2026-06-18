# CLAUDE.md — 7a0 Sete a Zero

Clone do jogo viral brasileiro "7a0 — Sete a Zero" (Copa do Mundo 2026).
Draft de jogadores históricos por dados + simulação de torneio por distribuição de Poisson + multiplayer via Socket.io.

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
├── db.js                      Persistência: PostgreSQL (pg) com fallback em memória
├── package.json
└── public/                    Servido estaticamente pelo Express
    ├── index.html             SPA — todas as telas em um único arquivo
    ├── style.css              Dark theme + cards FUT, mobile-first
    └── js/
        ├── engine.js          Motor compartilhado (UMD): Poisson, química, táticas, conquistas
        ├── data.js            Banco de dados de jogadores + helpers
        ├── simulation.js      Shim legado (núcleo migrou para engine.js)
        ├── game.js            Estado global + lógica de draft + restrições
        ├── profile.js         Perfil anônimo (uid no localStorage) + sync com backend
        ├── modes.js           Modos: Diário, Carreira, Restrição/Survival + conquistas UI
        ├── ui.js              Renderização DOM + cards + animações
        └── multiplayer.js     Cliente Socket.io
```

**Ordem de carregamento dos scripts** (declarada no `index.html`):
`engine.js` → `data.js` → `simulation.js` → `game.js` → `profile.js` → `modes.js` → `ui.js` → `socket.io.js` → `multiplayer.js`

Crítico: `engine.js` carrega **primeiro** (expõe globais via UMD). `server.js` faz
`require('./public/js/engine.js')` para usar a **mesma** matemática do client. `game.js` depende de
globais de `engine.js`/`data.js`; `modes.js` e `ui.js` dependem de `game.js`/`profile.js`;
`multiplayer.js` por último. Se a ordem mudar, quebra com "X is not defined".

## Motor compartilhado (`engine.js`)

Núcleo de simulação em padrão UMD (Node `module.exports` + browser globais). Principais exports:
`simulateTournament(players, seed, opts)`, `simulateVersus(teamA, teamB, seed)`, `calcChemistry`,
`calcTeamStats`, `TACTICS`, `PLAY_STYLES`/`getStyle`, `evaluateAchievements`/`ACHIEVEMENTS`,
`hashStringToSeed`, `encodeTeam`/`decodeTeam`. `opts = { tactic, captainId, slots, stages }`.

**Química por estilo:** cada jogador tem um campo opcional `style` no `data.js` (ver Posições/Estilos);
sem ele, `getStyle()` deriva por posição. Química = sinergia de estilos + alinhamento com a tática +
capitão. Alimenta o OVR efetivo usado em `calcTeamStats`.

## Modos de jogo (`modes.js`)

`state.gameMode`: `'solo' | 'daily' | 'career' | 'survival'` (+ `'restrict'`). 
- **Diário:** seed = `hashStringToSeed(YYYY-MM-DD)` gera `state.dailySeq` (mesma sequência de dados p/
  todos); `rollDice()` consome dessa sequência. Pontuação enviada a `/api/daily`.
- **Carreira:** `Profile` guarda `coins`/`careerRound`; dificuldade escala por rodada (`currentSimOpts`).
- **Restrição/Survival:** `state.restrictions` (`budget`, `oneCountry`) é checado em `pickPlayer`/
  `pickPlayerToSlot` via `canPickPlayer()`. Survival usa `buildSurvivalStages()` (fases infinitas).

`onTournamentComplete(simResult)` (chamado no fim de `animateSimulation`) faz recompensas, conquistas
e submissão do ranking diário.

## API REST (`server.js` → `db.js`)

- `GET /api/profile/:uid` · `PUT /api/profile/:uid`
- `POST /api/daily` (upsert por `(date,uid)`, mantém o maior score) · `GET /api/daily/:date`

---

## Telas (State Machine)

O estado global `state.screen` controla qual tela está visível. A função `goTo(screenId)` é a única forma de navegar — ela remove a classe `active` de todas as `.screen` e adiciona no `#screen-{screenId}`.

```
menu
 ├── Solo:  menu → mode → formation → draft → simulation → results
 └── Multi: menu → lobby → formation → draft → waiting → match
```

IDs das telas no HTML (mapeiam direto para `goTo`):
- `menu`, `mode`, `formation`, `draft`, `simulation`, `results`
- `lobby`, `waiting`, `match`

---

## Estado global (`game.js`)

```js
const state = {
  screen:        'menu',    // tela atual
  mode:          'classic', // 'classic' | 'memory'
  formation:     null,      // chave de FORMATIONS, ex: '4-3-3'
  slots:         [],        // [{ pos: 'ST', player: null | PlayerObj }]
  wildcards:     3,
  currentRoll:   null,      // { squad, players[] } — resultado do dado atual
  pickedPlayers: [],        // jogadores já escolhidos (espelho de slots com player)
  seed:          null,      // seed numérico gerado no initDraft
  isMultiplayer: false,
  simResults:    null,      // retorno de simulateTournament()
}
```

`state.slots` é o array canônico do time. Cada elemento tem `pos` (posição esperada) e `player` (null = vazio). A ordem dos slots segue exatamente a ordem declarada em `FORMATIONS[formation].slots`.

---

## Banco de dados (`data.js`)

### Estrutura de um jogador

```js
{
  id:       'pele-bra-70',   // string única — formato: nome-país-ano
  name:     'Pelé',
  country:  'Brasil',
  flag:     '🇧🇷',
  worldCup: 1970,            // número (ano da Copa)
  position: 'ST',            // posição (ver abaixo)
  overall:  99,              // 60–99
}
```

### Posições válidas
`GK`, `CB`, `LB`, `RB`, `LWB`, `RWB`, `CDM`, `CM`, `LM`, `RM`, `CAM`, `LW`, `RW`, `ST`

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
ST:  ['ST', 'LW', 'RW'],    // atacante pode jogar na ala
CM:  ['CM', 'CDM', 'CAM', 'LM', 'RM'],
LW:  ['LW', 'LM', 'ST'],
// etc.
```

A função `playerFitsSlot(playerPos, slotPos)` usa esse mapa. É chamada tanto no `rollDice` quanto no `pickPlayer`.

### Como adicionar jogadores

Adicione um objeto ao array `PLAYERS` em `data.js`. O ID deve ser único e seguir o padrão `nome-pais-ano`. Exemplo:

```js
{ id:"ronaldo-bra-94", name:"Ronaldo R9", country:"Brasil", flag:"🇧🇷", worldCup:1994, position:"ST", overall:88 },
```

Os índices `SQUADS` e `SQUAD_LIST` são gerados automaticamente no carregamento — não precisa mexer neles.

---

## Formações (`game.js`)

### Estrutura de uma formação

```js
FORMATIONS['4-3-3'] = {
  slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
  desc:  'Balanceada e versátil',
}
```

A ordem dos slots é importante: define o índice de cada posição no array `state.slots` e, portanto, o índice no `FIELD_POSITIONS` que determina onde cada círculo aparece no campo visual.

### Posições no campo (`FIELD_POSITIONS`)

```js
FIELD_POSITIONS['4-3-3'] = [
  [92, 50],   // índice 0 → GK  (y=92%, x=50%)
  [72, 80],   // índice 1 → RB
  ...
]
```

`y` = distância do topo (0 = beira do gol de cima, 100 = goleiro). `x` = distância da esquerda.

### Como adicionar uma nova formação

1. Adicione a entrada em `FORMATIONS` em `game.js` com o array `slots` de 11 posições
2. Adicione a entrada correspondente em `FIELD_POSITIONS` com 11 pares `[y, x]`
3. Pronto — `renderFormationGrid()` e `renderField()` são dinâmicos

---

## Motor de simulação (`simulation.js`)

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

Cada posição tem um peso de ataque e defesa (ver tabela em `simulation.js`). O ataque e defesa do time são médias ponderadas dos overalls dos jogadores multiplicados pelos pesos.

Pesos principais:
- ST: atk 1.0 / def 0.0
- GK: atk 0.0 / def 1.0
- CB: atk 0.0 / def 0.95
- CM: atk 0.5 / def 0.5
- CAM: atk 0.75 / def 0.1

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

Primeiro tenta encaixe exato (posição do jogador == posição do slot). Se não houver, usa qualquer slot aberto onde `playerFitsSlot` retorne true. Isso evita desperdiçar um ST em um slot de GK.

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
| `renderSimulation()` | Monta a tela de preview do time + stage cards vazios |
| `animateSimulation(result)` | Revela os resultados fase a fase (600ms por fase) |
| `renderResults(result, players)` | Preenche a tela de resultados finais |
| `renderMatchResult(data, isPlayerA)` | Preenche a tela de resultado multiplayer |
| `showToast(msg)` | Exibe notificação temporária por 3 segundos |

### Responsividade do campo

O campo usa `position: relative` e cada slot usa `position: absolute; left: X%; top: Y%`. Percentuais vêm de `FIELD_POSITIONS`. Funciona em qualquer tamanho de tela sem JS extra.

### Modo Clássico vs. De Memória

`state.mode` é verificado em `renderDraftPick` e `renderField` para decidir se mostra o overall ou `'?'`. Não há lógica separada — é puramente visual.

### Animação do torneio

`animateSimulation` oculta o botão "Simular", espera 300ms, depois revela cada fase com 600ms de intervalo. Ao final, chama `renderResults` e navega para `results`. O `btn-simulate` tem seu listener adicionado em `ui.js` (não em `game.js` — ver armadilha abaixo).

---

## Multiplayer (`multiplayer.js` + `server.js`)

### Estrutura de salas no servidor

```js
rooms = Map<roomCode, {
  players: [socketId, socketId?],   // máx 2
  teams:   [team|null, team|null],  // time de cada jogador
  timeout: Timer|null               // cleanup timer
}>
```

`socket.data.roomCode` e `socket.data.playerIndex` ficam guardados no socket para rastrear qual sala/jogador cada conexão representa.

### Eventos Socket.io

**Client → Server:**
| Evento | Payload | Resposta (callback) |
|--------|---------|---------------------|
| `create_room` | — | `{ roomCode }` |
| `join_room` | código (string) | `{ ok }` ou `{ error }` |
| `draft_complete` | array de 11 jogadores | — |

**Server → Client:**
| Evento | Payload | Quando |
|--------|---------|--------|
| `opponent_joined` | — | Oponente entrou (emitido só para o criador) |
| `both_connected` | — | Ambos estão na sala (emitido para os dois) |
| `opponent_ready` | — | Oponente terminou o draft |
| `match_result` | `{ goalsA, goalsB, statsA, statsB, teamA, teamB, seed }` | Ambos terminaram |
| `opponent_disconnected` | — | Oponente desconectou |

### Simulação no servidor

O servidor recalcula as stats dos dois times e roda a simulação (mesmas fórmulas Poisson do client) quando ambos os `draft_complete` chegam. O resultado é emitido via `match_result` para os dois sockets da sala.

### Flag `isPlayerA`

Em `multiplayer.js`, `isPlayerA = true` para quem criou a sala, `false` para quem entrou. Usada em `renderMatchResult(data, isPlayerA)` para saber se `data.goalsA` é o score "meu" ou do oponente.

### Cleanup de salas

- Após `match_result`: sala deletada em 5 minutos
- Após `disconnect`: sala deletada em 30 segundos (janela para reconexão)

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
`data.js` expõe `PLAYERS`, `SQUAD_LIST`, `POS_COMPAT`, `getTier`, `playerFitsSlot` como globais. `simulation.js` expõe `simulateTournament`, `calcTeamStats`, `generateSeed`, `encodeTeam`, `decodeTeam`. `game.js` expõe `state`, `FORMATIONS`, `FIELD_POSITIONS` e todas as funções de lógica. Se a ordem for alterada no `index.html`, o jogo quebra com "X is not defined".

### 3. `sendDraftComplete` é global de `multiplayer.js`
Em `ui.js`, `renderField()` chama `sendDraftComplete()` via `typeof sendDraftComplete === 'function'`. Isso funciona porque `multiplayer.js` declara a função no escopo global. Se `multiplayer.js` for refatorado para um módulo ES, esse acoplamento precisa ser resolvido.

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

### Mudar força dos adversários
Edite os valores `strength` em `STAGE_CONFIG` em `public/js/simulation.js`.

### Adicionar nova fase ao torneio
Adicione objeto em `STAGE_CONFIG`. Adicione o `id` no mapa `stageNames` em `renderResults()` em `ui.js`.

### Mudar tempo da animação
Em `animateSimulation()` em `ui.js`, o `setTimeout(showNext, 600)` controla o delay entre fases. O `setTimeout(..., 300)` inicial é o delay antes da primeira fase aparecer.

### Adicionar nova formação
1. Objeto em `FORMATIONS` em `game.js` (11 slots)
2. Array de 11 `[y, x]` em `FIELD_POSITIONS` em `game.js`

### Mudar cor do accent
Altere `--accent` e `--accent2` em `:root` no `style.css`.

### Mudar porta do servidor
`PORT` em `server.js` lê `process.env.PORT || 3000`. Passe `PORT=8080 node server.js` ou edite o fallback.
