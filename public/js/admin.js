/* ============================================================
   7a0 — Painel Admin (ferramenta local de dev)
   Editor de jogadores (filtros + edição) + documentação da lógica.
   Lê o PLAYERS global de data.js; salva via POST /api/admin/players.
   ============================================================ */
(function () {
  'use strict';

  const POS_LABELS = {
    gol: 'GOL', zag: 'ZAG', le: 'LE', ld: 'LD', vol: 'VOL', mc: 'MC',
    mei: 'MEI', me: 'ME', md: 'MD', pe: 'PE', pd: 'PD', ca: 'CA',
  };
  const POS_LIST = Object.keys(POS_LABELS);
  const MAX_ROWS = 300; // teto de linhas renderizadas (edições valem no dataset inteiro)

  // ── Cópia de trabalho: cada item ganha um _idx estável p/ edição ──
  const DATA = (typeof PLAYERS !== 'undefined' ? PLAYERS : []).map((p, i) => ({
    _idx: i,
    id: p.id, name: p.name, country: p.country, flag: p.flag,
    worldCup: p.worldCup, position: p.position,
    altPositions: Array.isArray(p.altPositions) ? p.altPositions.slice() : [],
    style: p.style, overall: p.overall,
  }));
  let nextIdx = DATA.length;
  const dirty = new Set();           // _idx alterados/adicionados
  let deletedDirty = false;          // alguma remoção pendente

  const $ = (id) => document.getElementById(id);
  const tierOf = (ov) => (typeof getTier === 'function' ? getTier(ov) : (ov >= 95 ? 'S' : ov >= 90 ? 'A' : ov >= 80 ? 'B' : 'C'));

  // ── Tabs ──
  document.querySelectorAll('.admin-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('tab-' + b.dataset.tab).classList.add('active');
    });
  });

  // ── Popular selects de filtro ──
  function populateFilters() {
    const countries = [...new Set(DATA.map(p => p.country))].sort((a, b) => a.localeCompare(b, 'pt'));
    const wcs = [...new Set(DATA.map(p => p.worldCup))].sort((a, b) => a - b);
    $('f-country').innerHTML = '<option value="">Todos</option>' + countries.map(c => `<option>${esc(c)}</option>`).join('');
    $('f-wc').innerHTML = '<option value="">Todas</option>' + wcs.map(w => `<option>${w}</option>`).join('');
    $('f-pos').innerHTML = '<option value="">Todas</option>' + POS_LIST.map(p => `<option value="${p}">${POS_LABELS[p]}</option>`).join('');
  }

  // ── Filtragem ──
  function getFiltered() {
    const q = $('f-search').value.trim().toLowerCase();
    const country = $('f-country').value;
    const wc = $('f-wc').value;
    const pos = $('f-pos').value;
    const min = parseInt($('f-min').value, 10);
    const max = parseInt($('f-max').value, 10);
    return DATA.filter(p => {
      if (p._deleted) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) return false;
      if (country && p.country !== country) return false;
      if (wc && String(p.worldCup) !== wc) return false;
      if (pos && p.position !== pos && !(p.altPositions || []).includes(pos)) return false;
      if (Number.isFinite(min) && p.overall < min) return false;
      if (Number.isFinite(max) && p.overall > max) return false;
      return true;
    });
  }

  // ── Render da tabela ──
  function render() {
    const filtered = getFiltered();
    const shown = filtered.slice(0, MAX_ROWS);
    const tbody = $('tbody');

    tbody.innerHTML = shown.map(p => rowHtml(p)).join('');
    $('empty').style.display = filtered.length ? 'none' : 'block';

    const total = DATA.filter(p => !p._deleted).length;
    const dirtyN = dirty.size + (deletedDirty ? 1 : 0);
    const capNote = filtered.length > MAX_ROWS ? ` — mostrando ${MAX_ROWS} (refine os filtros)` : '';
    $('count').innerHTML = `<b>${filtered.length}</b> de <b>${total}</b> jogadores${capNote}` +
      (dirtyN ? ` <span class="dirty">• ${dirty.size} edição(ões) não salvas</span>` : '');
    $('btn-save').disabled = !(dirty.size || deletedDirty);

    // Liga listeners de cada input
    tbody.querySelectorAll('tr').forEach(tr => {
      const idx = Number(tr.dataset.idx);
      tr.querySelectorAll('[data-field]').forEach(inp => {
        inp.addEventListener('input', () => onEdit(idx, inp.dataset.field, inp, tr));
      });
      tr.querySelector('.del-btn').addEventListener('click', () => onDelete(idx));
    });
  }

  function rowHtml(p) {
    const posOpts = POS_LIST.map(k => `<option value="${k}"${k === p.position ? ' selected' : ''}>${POS_LABELS[k]}</option>`).join('');
    const t = tierOf(p.overall);
    const cls = dirty.has(p._idx) ? ' class="row-dirty"' : '';
    return `<tr data-idx="${p._idx}"${cls}>
      <td><input class="id" data-field="id" value="${esc(p.id)}" /></td>
      <td><input data-field="name" value="${esc(p.name)}" /></td>
      <td><input data-field="country" value="${esc(p.country)}" /></td>
      <td><input data-field="flag" value="${esc(p.flag || '')}" /></td>
      <td><input type="number" data-field="worldCup" value="${p.worldCup}" /></td>
      <td><select data-field="position">${posOpts}</select></td>
      <td><input data-field="altPositions" value="${esc((p.altPositions || []).join(', '))}" /></td>
      <td><input type="number" data-field="overall" value="${p.overall}" min="1" max="99" /><span class="tier-badge tier-${t}">${t}</span></td>
      <td><button class="del-btn" title="Remover">🗑️</button></td>
    </tr>`;
  }

  function onEdit(idx, field, inp, tr) {
    const p = DATA.find(x => x._idx === idx);
    if (!p) return;
    if (field === 'worldCup' || field === 'overall') {
      p[field] = parseInt(inp.value, 10) || 0;
    } else if (field === 'altPositions') {
      p.altPositions = inp.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    } else {
      p[field] = inp.value;
    }
    dirty.add(idx);
    tr.classList.add('row-dirty');
    // Atualiza badge de tier ao vivo
    if (field === 'overall') {
      const t = tierOf(p.overall);
      const badge = tr.querySelector('.tier-badge');
      if (badge) { badge.className = 'tier-badge tier-' + t; badge.textContent = t; }
    }
    refreshCount();
  }

  function onDelete(idx) {
    const p = DATA.find(x => x._idx === idx);
    if (!p) return;
    if (!confirm(`Remover "${p.name}" (${p.id})?`)) return;
    p._deleted = true;
    dirty.delete(idx);
    deletedDirty = true;
    render();
  }

  function onAdd() {
    const p = {
      _idx: nextIdx++, id: '', name: '', country: '', flag: '',
      worldCup: 2026, position: 'ca', altPositions: [], overall: 75,
    };
    DATA.unshift(p);
    dirty.add(p._idx);
    // Limpa filtros para o novo aparecer no topo
    ['f-search', 'f-min', 'f-max'].forEach(id => $(id).value = '');
    ['f-country', 'f-wc', 'f-pos'].forEach(id => $(id).value = '');
    render();
  }

  function refreshCount() {
    const total = DATA.filter(p => !p._deleted).length;
    const filtered = getFiltered().length;
    const capNote = filtered > MAX_ROWS ? ` — mostrando ${MAX_ROWS} (refine os filtros)` : '';
    $('count').innerHTML = `<b>${filtered}</b> de <b>${total}</b> jogadores${capNote}` +
      (dirty.size ? ` <span class="dirty">• ${dirty.size} edição(ões) não salvas</span>` : '');
    $('btn-save').disabled = !(dirty.size || deletedDirty);
  }

  // ── Salvar ──
  async function save() {
    const payload = DATA.filter(p => !p._deleted).map(p => ({
      id: p.id, name: p.name, country: p.country, flag: p.flag,
      worldCup: p.worldCup, position: p.position,
      altPositions: p.altPositions || [],
      ...(p.style ? { style: p.style } : {}),
      overall: p.overall,
    }));
    // Checagem rápida no cliente
    const ids = new Set();
    for (const p of payload) {
      if (!p.id.trim()) return toast('Há jogador com ID vazio.', true);
      if (ids.has(p.id)) return toast('ID duplicado: ' + p.id, true);
      ids.add(p.id);
    }
    $('btn-save').disabled = true;
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: payload }),
      });
      const data = await res.json();
      if (!res.ok) { toast('Erro: ' + (data.error || res.status), true); $('btn-save').disabled = false; return; }
      dirty.clear(); deletedDirty = false;
      DATA.forEach(p => { delete p._deleted; });
      toast(`✅ Salvo: ${data.count} jogadores gravados no data.js (backup em data.js.bak).`);
      render();
    } catch (e) {
      toast('Falha de rede ao salvar.', true);
      $('btn-save').disabled = false;
    }
  }

  function toast(msg, isErr) {
    let el = $('admin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:8px;font-weight:600;font-size:14px;z-index:99;max-width:90%;box-shadow:0 4px 16px rgba(0,0,0,.4)';
      document.body.appendChild(el);
    }
    el.style.background = isErr ? 'var(--red)' : 'var(--accent)';
    el.style.color = isErr ? '#fff' : '#052e16';
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Wire up ──
  ['f-search', 'f-min', 'f-max'].forEach(id => $(id).addEventListener('input', render));
  ['f-country', 'f-wc', 'f-pos'].forEach(id => $(id).addEventListener('change', render));
  $('f-clear').addEventListener('click', () => {
    ['f-search', 'f-min', 'f-max'].forEach(id => $(id).value = '');
    ['f-country', 'f-wc', 'f-pos'].forEach(id => $(id).value = '');
    render();
  });
  $('btn-add').addEventListener('click', onAdd);
  $('btn-save').addEventListener('click', save);
  window.addEventListener('beforeunload', (e) => {
    if (dirty.size || deletedDirty || evDirty) { e.preventDefault(); e.returnValue = ''; }
  });

  populateFilters();
  render();
  renderDocs();
  // initEventsEditor() é chamado no fim da IIFE (depois das declarações let/const
  // do editor de eventos, para evitar a temporal dead zone).

  // ════════════════════════════════════════════════════════════
  //  DOCUMENTAÇÃO DA LÓGICA (texto fixo — números reais do engine.js)
  // ════════════════════════════════════════════════════════════
  function renderDocs() {
    $('docs').innerHTML = `
      <div class="toc">
        <a href="#d-fluxo">Visão geral</a>
        <a href="#d-stats">Força do time</a>
        <a href="#d-quimica">Química</a>
        <a href="#d-taticas">Táticas</a>
        <a href="#d-gols">Gols (Poisson)</a>
        <a href="#d-artilheiro">Artilheiro</a>
        <a href="#d-penaltis">Pênaltis</a>
        <a href="#d-torneio">Torneio</a>
        <a href="#d-conquistas">Conquistas</a>
      </div>

      <h2 id="d-fluxo">1. Visão geral — como se decide um vencedor</h2>
      <p>Toda partida é decidida por <b>qualidade do time + tática + química + sorte controlada</b>, nunca por
      cara-ou-coroa. O caminho é sempre:</p>
      <span class="formula">draft → química (calcChemistry) → força do time (calcTeamStats)
→ gols por partida (Poisson) → resultado → (empate no mata-mata) → pênaltis</span>
      <p>Tudo roda no <code>engine.js</code>, compartilhado entre cliente e servidor — a mesma matemática
      vale no solo e no multiplayer. A aleatoriedade usa um PRNG com <i>seed</i> (<code>mulberry32</code>),
      então o mesmo seed reproduz exatamente o mesmo resultado.</p>

      <h2 id="d-stats">2. Força do time (ataque / defesa / overall)</h2>
      <p>Cada posição tem um peso de ataque e de defesa (<code>WEIGHT_MAP</code>). O ataque e a defesa do
      time são médias ponderadas do <b>overall efetivo</b> (overall + bônus de química) de cada jogador.</p>
      <table>
        <tr><th>Pos</th><th>Peso ATK</th><th>Peso DEF</th></tr>
        <tr><td>ca</td><td>1.0</td><td>0.0</td></tr>
        <tr><td>pe / pd</td><td>0.85</td><td>0.0</td></tr>
        <tr><td>mei</td><td>0.75</td><td>0.1</td></tr>
        <tr><td>me / md / mc</td><td>0.5</td><td>0.5</td></tr>
        <tr><td>vol</td><td>0.2</td><td>0.6</td></tr>
        <tr><td>le / ld</td><td>0.1</td><td>0.8</td></tr>
        <tr><td>zag</td><td>0.0</td><td>0.95</td></tr>
        <tr><td>gol</td><td>0.0</td><td>1.0</td></tr>
      </table>
      <span class="formula">attack  = média ponderada(overall_efetivo · pesoATK) + baseFor_tática · 4
defense = média ponderada(overall_efetivo · pesoDEF) − baseAgainst_tática · 4
overall = média simples dos overalls</span>

      <h2 id="d-quimica">3. Química</h2>
      <p>Cada jogador tem um <b>estilo</b> (<code>style</code> no data.js; se não tiver, é derivado da posição).
      Estilos: Retranca 🛡️, Contra-ataque ⚡, Posse 🎯, Drible 🪄, Físico 💪, Armador 🧠, Goleador 🎰.</p>
      <p>A química soma quatro fatores: sinergia par-a-par dos estilos, alinhamento com a tática, ênfase do
      capitão e penalidade por jogador fora de posição.</p>
      <span class="formula">química = clamp( 40
  + (sinergias / máx) · 40        // pares de estilos que combinam (forte=2, igual=1)
  + (% no estilo da tática) · 15
  + (% no estilo do capitão) · 5
  − penalidade_posição · 1.5 , 0, 100 )</span>
      <p><b>Pares de sinergia forte:</b> Armador+Goleador, Contra-ataque+Retranca, Posse+Drible,
      Físico+Goleador, Armador+Drible, Posse+Armador, Contra-ataque+Físico.</p>
      <p>A química vira <b>bônus de overall efetivo</b> por jogador (até <code>+4</code>), e quem joga fora
      da posição natural perde pontos (<code>−1</code> em posição alternativa, <code>−3</code> totalmente
      fora). Esse efetivo é o que entra no cálculo de força acima.</p>

      <h2 id="d-taticas">4. Táticas</h2>
      <p>A tática desloca a base dos gols (<code>baseFor</code>/<code>baseAgainst</code>) e premia certos
      estilos na química. <i>Contra-ataque</i> ainda ganha um bônus extra quando o adversário é mais forte.</p>
      <table>
        <tr><th>Tática</th><th>baseFor</th><th>baseAgainst</th><th>Favorece</th><th>Counter</th></tr>
        <tr><td>⚖️ Equilibrada</td><td>0.0</td><td>0.0</td><td>—</td><td>não</td></tr>
        <tr><td>🔥 Ofensiva</td><td>+0.35</td><td>+0.30</td><td>goleador, drible, posse</td><td>não</td></tr>
        <tr><td>🧱 Defensiva</td><td>−0.30</td><td>−0.40</td><td>retranca, físico</td><td>não</td></tr>
        <tr><td>⚡ Contra-ataque</td><td>+0.10</td><td>−0.10</td><td>contra-ataque, goleador, físico</td><td><b>sim</b> (+0.35 se o rival for mais forte)</td></tr>
        <tr><td>🎯 Posse de bola</td><td>+0.20</td><td>−0.05</td><td>posse, armador, drible</td><td>não</td></tr>
      </table>

      <h2 id="d-gols">5. Gols por partida (Poisson)</h2>
      <p>O número de gols de cada lado é sorteado de uma <b>distribuição de Poisson</b> cujo parâmetro
      (<code>lambda</code>) depende da diferença entre o ataque de um e a defesa do outro:</p>
      <span class="formula">lambda = 1.4 + base_tática + (minhaForça − forçaAdversário) · 0.10
         (+0.15 a favor quando |diferença| > 8 — reduz zebra)
lambda final = clamp(lambda, 0.12, 5)

golsFavor   = Poisson(lambdaAtaque_meu_vs_defesa_dele)
golsContra  = Poisson(lambdaAtaque_dele_vs_defesa_minha)</span>
      <p>O multiplicador <code>0.10</code> controla quanto a diferença de qualidade pesa: mais alto = menos
      zebra. O empurrão de <code>+0.15</code> para diferenças grandes (&gt;8) reduz ainda mais a chance de
      um time muito superior tropeçar. A <code>winProbability</code> (Poisson × Poisson somando os placares)
      é calculada à parte só para exibir a probabilidade — o placar real vem do sorteio.</p>

      <h2 id="d-artilheiro">6. Quem marca o gol</h2>
      <p>Para cada gol, o autor é sorteado com peso = <code>overall · pesoArtilheiro</code>. Estilo
      <i>goleador</i> finaliza ×1.35; <i>armador</i> ×0.9.</p>
      <table>
        <tr><th>Pos</th><th>Peso</th></tr>
        <tr><td>ca / pe / pd</td><td>1.0</td></tr>
        <tr><td>mei</td><td>0.7</td></tr>
        <tr><td>mc / me / md</td><td>0.45</td></tr>
        <tr><td>vol</td><td>0.22</td></tr>
        <tr><td>zag / le / ld</td><td>0.12</td></tr>
        <tr><td>gol</td><td>0.01 (0.25 p/ goleiros-batedores históricos)</td></tr>
      </table>
      <p>O minuto do gol é <code>1 + floor(90 · random^0.85)</code> (levemente concentrado no fim do jogo).</p>

      <h2 id="d-penaltis">7. Disputa de pênaltis (empate no mata-mata)</h2>
      <p>Decidida pela <b>qualidade</b>, não por 50/50. Cada jogador tem uma "habilidade de pênalti" =
      overall + bônus por posição:</p>
      <table>
        <tr><th>Pos</th><th>Bônus</th><th>Pos</th><th>Bônus</th></tr>
        <tr><td>ca</td><td>+10</td><td>me / md</td><td>+4</td></tr>
        <tr><td>pe / pd</td><td>+8</td><td>mc</td><td>+3</td></tr>
        <tr><td>mei</td><td>+7</td><td>vol</td><td>0</td></tr>
        <tr><td>le / ld</td><td>−3</td><td>zag</td><td>−7</td></tr>
        <tr><td>gol</td><td>−14</td><td></td><td></td></tr>
      </table>
      <span class="formula">P(gol) = clamp( 0.74 + (habilidade_cobrador − overall_goleiro) · 0.011, 0.25, 0.96 )</span>
      <p>Sobe com a qualidade do cobrador, desce com o goleiro adversário. Quando não é gol, sorteia entre
      <b>defesa</b> (mais provável com goleiro bom) e <b>para fora</b>. A ordem de batedores é a escolhida
      pelo usuário; o resto entra por habilidade. <b>Melhor de 5</b> com parada antecipada; empate após 5 →
      <b>morte súbita</b> (1 cobrança para cada). Tudo determinístico pelo seed.</p>
      <p class="note">Para mexer no peso qualidade × sorte: a constante <code>0.011</code> e os limites
      <code>clamp(…, 0.25, 0.96)</code> em <code>penaltyConvProb</code>, e a tabela
      <code>PENALTY_POS_BONUS</code> — tudo no <code>engine.js</code>.</p>

      <h2 id="d-torneio">8. Formato do torneio</h2>
      <p>Copa do Mundo: 4 grupos de 4 (pontos corridos) → top 2 de cada → quartas → semi → final. O solo
      usa chave de 16 (15 bots = seleções históricas reais); o multiplayer escala 4/8/16 conforme o nº de
      jogadores, completando com bots.</p>
      <ul>
        <li><b>Fase de grupos:</b> empate classifica — só elimina quem perde.</li>
        <li><b>Mata-mata:</b> precisa vencer; empate vai aos pênaltis.</li>
        <li><b>Diário:</b> seed fixo do dia → mesmos bots e chave para todos (ranking justo).</li>
        <li><b>Carreira:</b> adversários ficam mais fortes por rodada (<code>minAvgOverall</code> escala).</li>
      </ul>
      <p class="note">O modo <b>Survival</b> é a exceção: usa a campanha antiga contra força crescente por
      fase (<code>STAGE_CONFIG</code>: 68 → 71 → 74 → 79 → 83 → 87 → 91).</p>

      <h2 id="d-conquistas">9. Conquistas</h2>
      <ul>
        <li>🏆 <b>Campeão do Mundo</b> — vença a final.</li>
        <li>🛡️ <b>Campanha Invicta</b> — campeão sem perder nenhuma partida.</li>
        <li>7️⃣ <b>Sete a Zero</b> — aplique um 7×0 (ou mais) em uma fase.</li>
        <li>🔗 <b>Entrosamento Total</b> — química 100.</li>
        <li>🎆 <b>Show na Final</b> — vença a final por 3+ gols de diferença.</li>
      </ul>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  EDITOR DO MODO INTERATIVO (events.js)
  // ════════════════════════════════════════════════════════════
  let evCfg = null, evDirty = false, evNextId = 1;

  const RULE_META = {
    STAMINA_START:     { label: 'Fôlego inicial',      desc: 'Fôlego de cada time no apito inicial.',               step: 1 },
    STAMINA_LOW:       { label: 'Fôlego baixo',        desc: 'Abaixo disso, penalidade nos minutos finais.',        step: 1 },
    STAMINA_DRAIN_MIN: { label: 'Desgaste por minuto', desc: 'Fôlego perdido passivamente a cada minuto.',          step: 0.05 },
    LATE_MINUTE:       { label: 'Minuto "final"',      desc: 'A partir daqui vale a penalidade de fôlego.',         step: 1 },
    MOMENTUM_MINUTES:  { label: 'Duração do momentum', desc: 'Minutos de jogo que o buff dura.',                    step: 1 },
    MOMENTUM_BONUS:    { label: 'Bônus do momentum',   desc: 'Eficácia extra com momentum (0.05 = +5%).',           step: 0.01 },
    STAMINA_PENALTY:   { label: 'Penalidade de fôlego',desc: 'Multiplicador com fôlego baixo no fim (0.85 = −15%).',step: 0.01 },
    RED_PENALTY:       { label: 'Penalidade vermelho', desc: 'Perda de eficácia por expulsão (0.07 = −7%).',        step: 0.01 },
    CRIT_FAIL_PROB:    { label: 'Chance de vermelho',  desc: 'Prob. de expulsão ao usar ação agressiva (0.14 = 14%).', step: 0.01 },
  };

  function initEventsEditor() {
    const status = document.getElementById('ev-status');
    if (typeof Events === 'undefined' || !Events.ATK_ACTIONS) { status.textContent = 'events.js não carregou.'; return; }
    document.getElementById('ev-save').addEventListener('click', saveEvents);
    document.getElementById('ev-reset').addEventListener('click', loadEvCfg);
    const root = document.getElementById('ev-root');
    root.addEventListener('input', onEvInput);
    root.addEventListener('change', onEvChange);
    root.addEventListener('click', onEvClick);
    loadEvCfg();
  }

  function classifyAdv(cell) {
    const eq = (x, y) => x && y && +x.ma === +y.ma && +x.md === +y.md;
    if (eq(cell, Events.ADV_WIN)) return 'win';
    if (eq(cell, Events.ADV_LOSE)) return 'lose';
    return 'neu';
  }

  function loadEvCfg() {
    evNextId = 1;
    const mkAct = (a, def) => ({ _id: evNextId++, key: a.key, label: a.label, emoji: a.emoji || '', staminaCost: a.staminaCost, desc: a.desc || '', ...(def ? { aggressive: !!a.aggressive } : {}) });
    const atk = Object.values(Events.ATK_ACTIONS).map(a => mkAct(a, false));
    const def = Object.values(Events.DEF_ACTIONS).map(a => mkAct(a, true));
    const matrix = {};
    atk.forEach(at => {
      matrix[at._id] = {};
      def.forEach(df => {
        const cell = Events.ADVANTAGE_MATRIX[at.key] && Events.ADVANTAGE_MATRIX[at.key][df.key];
        matrix[at._id][df._id] = cell ? classifyAdv(cell) : 'neu';
      });
    });
    const rules = {};
    Object.keys(RULE_META).forEach(k => { rules[k] = Events[k]; });
    evCfg = {
      atkActions: atk, defActions: def, matrix,
      adv: {
        win:  { ma: Events.ADV_WIN.ma,  md: Events.ADV_WIN.md },
        lose: { ma: Events.ADV_LOSE.ma, md: Events.ADV_LOSE.md },
        neu:  { ma: Events.ADV_NEU.ma,  md: Events.ADV_NEU.md },
      },
      rules,
    };
    evDirty = false;
    renderEvents();
  }

  function renderEvents() {
    if (!evCfg) return;
    document.getElementById('ev-root').innerHTML =
      actionsBlock('atk', 'Ações de Ataque', evCfg.atkActions) +
      actionsBlock('def', 'Ações de Defesa', evCfg.defActions) +
      matrixBlock() + advBlock() + rulesBlock();
    evStatus();
  }

  function actionsBlock(side, title, list) {
    const cards = list.map(a => `
      <div class="ev-card" data-id="${a._id}">
        <button class="del-x" data-ev="del" data-side="${side}" data-id="${a._id}" title="Remover">✕</button>
        <div class="row">
          <input class="emoji" type="text" maxlength="4" data-ev="act" data-side="${side}" data-id="${a._id}" data-field="emoji" value="${esc(a.emoji)}" />
          <input type="text" placeholder="Nome" data-ev="act" data-side="${side}" data-id="${a._id}" data-field="label" value="${esc(a.label)}" />
        </div>
        <div class="row"><label>key</label><input type="text" data-ev="act" data-side="${side}" data-id="${a._id}" data-field="key" value="${esc(a.key)}" /></div>
        <div class="row"><label>fôlego</label><input type="number" min="0" max="30" data-ev="act" data-side="${side}" data-id="${a._id}" data-field="staminaCost" value="${a.staminaCost}" /></div>
        <div class="row"><label>desc</label><input type="text" data-ev="act" data-side="${side}" data-id="${a._id}" data-field="desc" value="${esc(a.desc)}" /></div>
        ${side === 'def' ? `<label class="agg"><input type="checkbox" data-ev="act" data-side="def" data-id="${a._id}" data-field="aggressive" ${a.aggressive ? 'checked' : ''} /> agressiva (risco de vermelho)</label>` : ''}
      </div>`).join('');
    return `<div class="ev-block"><h3>${title}</h3>
      <p class="hint">As opções que o jogador vê no lance. Pode adicionar/remover — a UI do jogo renderiza dinamicamente.</p>
      <div class="ev-cards">${cards}<button class="ev-add" data-ev="add" data-side="${side}">+ Adicionar ação</button></div></div>`;
  }

  function matrixBlock() {
    const atk = evCfg.atkActions, def = evCfg.defActions;
    const head = def.map(d => `<th>${esc(d.emoji)} ${esc(d.label)}</th>`).join('');
    const rows = atk.map(a => {
      const cells = def.map(d => {
        const v = (evCfg.matrix[a._id] && evCfg.matrix[a._id][d._id]) || 'neu';
        return `<td><select class="${v}" data-ev="mat" data-atk="${a._id}" data-def="${d._id}">
          <option value="win"${v === 'win' ? ' selected' : ''}>⚔️ Atacante</option>
          <option value="neu"${v === 'neu' ? ' selected' : ''}>= Neutro</option>
          <option value="lose"${v === 'lose' ? ' selected' : ''}>🛡️ Defensor</option></select></td>`;
      }).join('');
      return `<tr><th class="rowhead">${esc(a.emoji)} ${esc(a.label)}</th>${cells}</tr>`;
    }).join('');
    return `<div class="ev-block"><h3>Matriz de Vantagem</h3>
      <p class="hint">Linha = ação de ataque · coluna = ação de defesa. Quem leva a melhor no confronto.</p>
      <table class="matrix"><thead><tr><th class="corner"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function advBlock() {
    const grp = (g, lbl) => `<div class="ev-rule"><label>${lbl}</label>
      <div class="pair">
        <input type="number" step="0.01" data-ev="adv" data-grp="${g}" data-field="ma" value="${evCfg.adv[g].ma}" title="ma — multiplica o ataque" />
        <input type="number" step="0.01" data-ev="adv" data-grp="${g}" data-field="md" value="${evCfg.adv[g].md}" title="md — multiplica a defesa" />
      </div><div class="desc">ma (ataque) · md (defesa)</div></div>`;
    return `<div class="ev-block"><h3>Multiplicadores da Matriz</h3>
      <p class="hint">Quanto cada desfecho pesa. <code>ma</code> multiplica o ataque, <code>md</code> a defesa. &gt;1 favorece.</p>
      <div class="ev-adv">${grp('win', '⚔️ Vantagem do atacante')}${grp('neu', '= Neutro')}${grp('lose', '🛡️ Vantagem do defensor')}</div></div>`;
  }

  function rulesBlock() {
    const items = Object.keys(RULE_META).map(k => {
      const m = RULE_META[k];
      return `<div class="ev-rule"><label>${m.label} <code>${k}</code></label>
        <input type="number" step="${m.step}" data-ev="rule" data-field="${k}" value="${evCfg.rules[k]}" />
        <div class="desc">${m.desc}</div></div>`;
    }).join('');
    return `<div class="ev-block"><h3>Constantes de Regra</h3>
      <p class="hint">Momentum, fôlego e cartão vermelho. Veja a aba Documentação para o efeito de cada uma.</p>
      <div class="ev-rules">${items}</div></div>`;
  }

  function findAct(side, id) {
    return (side === 'atk' ? evCfg.atkActions : evCfg.defActions).find(a => a._id === +id);
  }
  function evMark() { evDirty = true; evStatus(); }
  function evStatus() {
    const s = document.getElementById('ev-status');
    if (!s || !evCfg) return;
    s.innerHTML = `<b>${evCfg.atkActions.length}</b> ataque · <b>${evCfg.defActions.length}</b> defesa` +
      (evDirty ? ' <span class="dirty">• alterações não salvas</span>' : ' • salvo');
    document.getElementById('ev-save').disabled = !evDirty;
  }

  function onEvInput(e) {
    const t = e.target, kind = t.dataset.ev;
    if (kind === 'act') {
      const a = findAct(t.dataset.side, t.dataset.id); if (!a) return;
      const f = t.dataset.field;
      if (f === 'staminaCost') a[f] = parseFloat(t.value) || 0;
      else if (f === 'aggressive') a[f] = t.checked;
      else a[f] = t.value;
      evMark();
    } else if (kind === 'adv') {
      evCfg.adv[t.dataset.grp][t.dataset.field] = parseFloat(t.value) || 0; evMark();
    } else if (kind === 'rule') {
      evCfg.rules[t.dataset.field] = parseFloat(t.value); evMark();
    } else if (kind === 'mat') {
      evCfg.matrix[t.dataset.atk][t.dataset.def] = t.value; t.className = t.value; evMark();
    }
  }

  function onEvChange(e) {
    const t = e.target, kind = t.dataset.ev;
    if (kind === 'mat') { evCfg.matrix[t.dataset.atk][t.dataset.def] = t.value; t.className = t.value; evMark(); }
    else if (kind === 'act' && t.dataset.field === 'aggressive') { const a = findAct(t.dataset.side, t.dataset.id); if (a) { a.aggressive = t.checked; evMark(); } }
    else if (kind === 'act' && ['key', 'label', 'emoji'].includes(t.dataset.field)) { renderEvents(); } // atualiza cabeçalhos da matriz
  }

  function onEvClick(e) {
    const btn = e.target.closest('[data-ev]'); if (!btn) return;
    if (btn.dataset.ev === 'add') addAction(btn.dataset.side);
    else if (btn.dataset.ev === 'del') delAction(btn.dataset.side, btn.dataset.id);
  }

  function addAction(side) {
    const base = side === 'atk'
      ? { _id: evNextId++, key: '', label: '', emoji: '⚽', staminaCost: 7, desc: '' }
      : { _id: evNextId++, key: '', label: '', emoji: '🧤', staminaCost: 6, desc: '', aggressive: false };
    (side === 'atk' ? evCfg.atkActions : evCfg.defActions).push(base);
    rebuildMatrixKeys(); evMark(); renderEvents();
  }
  function delAction(side, id) {
    const list = side === 'atk' ? evCfg.atkActions : evCfg.defActions;
    if (list.length <= 1) { toast('Precisa de ao menos 1 ação.', true); return; }
    const idx = list.findIndex(a => a._id === +id); if (idx < 0) return;
    list.splice(idx, 1);
    rebuildMatrixKeys(); evMark(); renderEvents();
  }
  function rebuildMatrixKeys() {
    const m = {};
    evCfg.atkActions.forEach(at => {
      m[at._id] = {};
      evCfg.defActions.forEach(df => { m[at._id][df._id] = (evCfg.matrix[at._id] && evCfg.matrix[at._id][df._id]) || 'neu'; });
    });
    evCfg.matrix = m;
  }

  async function saveEvents() {
    const keyRe = /^[a-z][a-z0-9_]*$/;
    for (const [side, list] of [['Ataque', evCfg.atkActions], ['Defesa', evCfg.defActions]]) {
      const seen = new Set();
      for (const a of list) {
        if (!keyRe.test(a.key)) return toast(`${side}: key inválida "${a.key}" (minúsculas, começa por letra)`, true);
        if (seen.has(a.key)) return toast(`${side}: key duplicada "${a.key}"`, true);
        seen.add(a.key);
        if (!String(a.label).trim()) return toast(`${side}: "${a.key}" sem nome`, true);
      }
    }
    const strip = (a, def) => ({ key: a.key, label: a.label, emoji: a.emoji, staminaCost: a.staminaCost, desc: a.desc, ...(def ? { aggressive: !!a.aggressive } : {}) });
    const matrix = {};
    evCfg.atkActions.forEach(at => {
      matrix[at.key] = {};
      evCfg.defActions.forEach(df => { matrix[at.key][df.key] = evCfg.matrix[at._id][df._id]; });
    });
    const payload = {
      atkActions: evCfg.atkActions.map(a => strip(a, false)),
      defActions: evCfg.defActions.map(a => strip(a, true)),
      adv: evCfg.adv, matrix, rules: evCfg.rules,
    };
    document.getElementById('ev-save').disabled = true;
    try {
      const res = await fetch('/api/admin/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast('Erro: ' + (data.error || res.status), true); document.getElementById('ev-save').disabled = false; return; }
      evDirty = false; evStatus();
      toast(`✅ Salvo: ${data.atk} ações de ataque e ${data.def} de defesa (backup em events.js.bak). Reinicie o servidor p/ valer no multiplayer.`);
    } catch (e) {
      toast('Falha de rede ao salvar.', true); document.getElementById('ev-save').disabled = false;
    }
  }

  initEventsEditor();
})();
