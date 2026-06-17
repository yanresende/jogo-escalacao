# 7a0 — Sete a Zero

Clone do jogo viral brasileiro lançado durante a Copa do Mundo 2026. Monte seu time dos sonhos com craques históricos de todas as Copas do Mundo (1958–2026) via mecânica de draft por dados, depois simule um torneio completo.

---

## Funcionalidades

- **Draft por dados** — role o dado, receba uma seleção histórica aleatória, escolha um jogador para preencher sua formação
- **+350 jogadores históricos** — de Pelé 1970 a Mbappé 2026, com ratings individuais
- **8 formações táticas** — 4-3-3, 4-4-2, 4-2-3-1, 4-2-4, 3-5-2, 5-3-2, 4-5-1, 3-4-3
- **2 modos de jogo** — Clássico (ratings visíveis) e De Memória (ratings ocultos)
- **3 wildcards por partida** — pule rolagens indesejadas
- **Simulação realista** — motor baseado em distribuição de Poisson com fórmulas extraídas por engenharia reversa do jogo original
- **Torneio completo** — fase de grupos + oitavas + quartas + semis + final, com animação fase a fase
- **Multiplayer em tempo real** — crie uma sala, compartilhe o código, dispute contra um amigo via Socket.io
- **Compartilhar time** — gera uma URL que carrega seu time direto na tela de simulação

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior

---

## Instalação

```bash
# Clone ou baixe o projeto
cd "caminho/para/jogo"

# Instale as dependências
npm install
```

---

## Como rodar

```bash
node server.js
```

Abra o navegador em **http://localhost:3000**

Para usar uma porta diferente:

```bash
PORT=8080 node server.js
```

---

## Como jogar

### Modo Solo

1. Clique em **Jogar Solo**
2. Escolha o modo: **Clássico** (ratings visíveis) ou **De Memória** (ratings ocultos)
3. Escolha sua **formação** (4-3-3, 4-4-2, etc.)
4. **Role o dado** — você recebe uma seleção histórica aleatória com jogadores disponíveis
5. **Clique no jogador** que deseja recrutar para preencher um slot da sua formação
6. Repita até completar os 11 jogadores (use os **3 wildcards ⚡** para pular rolagens ruins)
7. Clique em **Simular Torneio** e acompanhe os resultados fase a fase
8. Use **Compartilhar Time** para copiar a URL do seu time

### Modo Multiplayer

**Jogador A (cria a sala):**
1. Clique em **Multiplayer** → **Criar Sala**
2. Compartilhe o código de 6 letras com seu amigo
3. Aguarde o oponente entrar — quando conectar, escolha sua formação e faça o draft

**Jogador B (entra na sala):**
1. Clique em **Multiplayer**
2. Digite o código de 6 letras → **Entrar**
3. Escolha sua formação e faça o draft

Quando os dois terminarem o draft, o servidor simula a partida automaticamente e exibe o resultado para ambos em tempo real.

---

## Ratings dos jogadores

| Tier | Faixa | Cor |
|------|-------|-----|
| S | 95–99 | Dourado |
| A | 90–94 | Roxo |
| B | 80–89 | Azul |
| C | <80 | Cinza |

Jogadores S-tier incluem: Pelé (99), Maradona (99), Messi 2022 (99), Cruyff (97), Ronaldo R9 2002 (99), Zidane (97), Mbappé 2026 (98)

---

## Força dos adversários no torneio

| Fase | Força do adversário |
|------|-------------------|
| Grupos — Jogo 1 | 68 |
| Grupos — Jogo 2 | 71 |
| Grupos — Jogo 3 | 74 |
| Oitavas de Final | 79 |
| Quartas de Final | 83 |
| Semifinal | 87 |
| Final | 91 |

Um time com OVR médio de 90 tem ~46% de chance de vencer a final. Um time mediano (OVR 80) raramente passa das quartas.

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript puro (sem framework) |
| Backend | Node.js + Express |
| Multiplayer | Socket.io |
| Simulação | Distribuição de Poisson + PRNG Mulberry32 |

---

## Estrutura do projeto

```
jogo/
├── server.js          Servidor Node.js (Express + Socket.io)
├── package.json
├── CLAUDE.md          Documentação técnica detalhada para desenvolvimento
└── public/
    ├── index.html     SPA — todas as telas
    ├── style.css      Dark theme, mobile-first
    └── js/
        ├── data.js        Banco de dados de jogadores + helpers
        ├── simulation.js  Motor de simulação (Poisson)
        ├── game.js        Estado global + lógica de draft
        ├── ui.js          Renderização e animações
        └── multiplayer.js Cliente Socket.io
```

---

## Créditos

Inspirado no jogo original **7a0 — Sete a Zero** criado por um desenvolvedor brasileiro independente em junho de 2026, durante a Copa do Mundo FIFA 2026. O motor de simulação foi recriado com base em engenharia reversa pública das fórmulas matemáticas do jogo.
