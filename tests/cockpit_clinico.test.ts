import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  extractPepBodies,
  parseBalancedBrackets,
  splitTopLevelChoices,
  computeWeightBasedDoses
} from '../src/engine/personalizar.ts';
import {
  escapeHtml,
  formatGuiaInlineHtml,
  classifyGuiaSectionTheme
} from '../src/engine/diretrizes.ts';
import {
  normalizeSearchText,
  findMatchedSymptom
} from '../src/engine/search.ts';
import {
  CRITICAL_PROTOCOL_IDS,
  getClinicalSeverity
} from '../src/engine/workstation.ts';
import {
  MODULE_COUNTS,
  summarizeProtocolCounts,
  type ClinicalProtocolItem
} from '../src/data/clinical_data.ts';

const htmlPath = path.resolve(process.cwd(), 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

function extractScriptAndRun() {
  const scriptMatch = htmlContent.match(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Script block must exist in index.html');

  const todosJsonPath = path.resolve(process.cwd(), 'snippets/snippets_todos.json');
  const rawTodosData = JSON.parse(fs.readFileSync(todosJsonPath, 'utf8'));

  // Remove ES module import statements so the script body can execute in node:vm
  const scriptBody = scriptMatch[1].replace(
    /^\s*import\s+rawAllData\s+from\s+['"][^'"]+['"];\s*$/m,
    ''
  );

  // Minimal DOM mock to run index.html script in Node VM
  const makeEl = () => {
    const _cls = new Set<string>();
    let _innerHTML = '';
    const el: any = {
      style: {},
      dataset: {},
      get className() { return Array.from(_cls).join(' '); },
      set className(v: string) {
        _cls.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach(c => _cls.add(c));
      },
      classList: {
        _set: _cls,
        add(...cls: string[]) { cls.forEach(c => _cls.add(c)); },
        remove(...cls: string[]) { cls.forEach(c => _cls.delete(c)); },
        toggle(c: string, force?: boolean) {
          if (force === undefined) {
            if (_cls.has(c)) _cls.delete(c);
            else _cls.add(c);
          } else if (force) {
            _cls.add(c);
          } else {
            _cls.delete(c);
          }
        },
        contains(c: string) { return _cls.has(c); }
      },
      get innerHTML() { return _innerHTML; },
      set innerHTML(v: string) {
        _innerHTML = String(v ?? '');
        if (_innerHTML === '') {
          el.children = [];
          el.childNodes = [];
        }
      },
      textContent: '',
      value: '',
      nodeType: 1,
      children: [] as any[],
      childNodes: [] as any[],
    appendChild(child: any) {
      if (child && child._isFragment) {
        child.children.forEach((c: any) => { this.children.push(c); this.childNodes.push(c); });
        child.children = [];
        child.childNodes = [];
        return child;
      }
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
    closest() { return null; },
    scrollIntoView() {},
    scrollTo() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
      focus() {},
      select() {}
    };
    return el;
  };

  const elements: Record<string, any> = {};
  const getEl = (id: string) => {
    if (!elements[id]) elements[id] = makeEl();
    return elements[id];
  };

  const vibrateCalls: any[] = [];
  const mockCards = Array.from({ length: 105 }, (_, idx) => {
    const el = makeEl();
    el.dataset = {
      mod: idx < 16 ? 'go' : idx < 63 ? 'upa' : idx < 70 ? 'enf' : idx < 83 ? 'ped' : 'hab',
      cat: 'Categoria Teste',
      search: ''
    };
    el.style = { display: idx < 83 ? 'flex' : 'none' };
    el.scrollIntoView = () => {};
    return el;
  });

  const sandbox: any = {
    window: {
      innerWidth: 1440,
      addEventListener() {},
      scrollTo() {}
    },
    document: {
      activeElement: null,
      documentElement: {
        style: {
          _props: {} as Record<string, string>,
          setProperty(k: string, v: string) { this._props[k] = v; }
        }
      },
      getElementById: getEl,
      querySelector: () => makeEl(),
      querySelectorAll: (sel: string) => (sel === '.card' ? mockCards : []),
      createElement: () => makeEl(),
      createDocumentFragment: () => Object.assign(makeEl(), { _isFragment: true }),
      createTextNode: (t: string) => ({ nodeType: 3, textContent: t }),
      body: makeEl(),
      execCommand: () => true
    },
    Node: { TEXT_NODE: 3 },
    navigator: {
      vibrate: (pattern: number[]) => {
        vibrateCalls.push(pattern);
        return true;
      },
      clipboard: {
        writeText: async () => {}
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    rawAllData: rawTodosData,
    performance,
    setTimeout,
    clearTimeout,
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptBody, sandbox);
  const runExpr = (expr: string) => vm.runInContext(expr, sandbox);
  return { sandbox, elements, vibrateCalls, runExpr, mockCards };
}

test('Prompt 1: Semantic search maps tags_sintomas and ranks Asma, DPOC, and EAP at top for "falta de ar"', () => {
  const { sandbox, runExpr } = extractScriptAndRun();
  const allData = runExpr('allData');
  assert.equal(allData.length, 105, 'All 105 protocols (83 PEP + 22 Habilidades) must be preserved');

  const pepCount = Array.from(allData).filter((x: any) => x.mod_id !== 'hab').length;
  const habCount = Array.from(allData).filter((x: any) => x.mod_id === 'hab').length;
  assert.equal(pepCount, 83, 'Must have exactly 83 PEP protocols');
  assert.equal(habCount, 22, 'Must have exactly 22 Habilidades Clínicas cards');

  const t0 = performance.now();
  sandbox.window.searchCommandPalette('falta de ar');
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 16, `Search latency (${elapsed.toFixed(2)}ms) must be under 16ms`);

  const matches = runExpr('cmdMatches');
  assert.ok(matches.length >= 3, 'Must return at least 3 matches for "falta de ar"');

  const top3Ids = Array.from(matches.slice(0, 3), (m: any) => m.item.id);
  assert.deepEqual(top3Ids, ['upa-32', 'upa-33', 'upa-34'], 'Top 3 protocols for "falta de ar" must be Asma (upa-32), DPOC (upa-33), and EAP (upa-34)');

  matches.slice(0, 3).forEach((m: any) => {
    assert.equal(m.matchedSymptom, 'falta de ar');
    assert.equal(m.isTopHighlight, true);
  });
});

test('Prompt 1: Semantic search handles "dor no peito", "dor de cabeça", "sangramento", and "febre"', () => {
  const { sandbox, runExpr } = extractScriptAndRun();

  sandbox.window.searchCommandPalette('dor no peito');
  let matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.id, 'upa-30', 'Dor Torácica / SCA must be #1 for "dor no peito"');
  assert.equal(matches[0].matchedSymptom, 'dor no peito');

  sandbox.window.searchCommandPalette('dor de cabeça');
  matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.id, 'upa-35', 'Cefaleia Aguda must be #1 for "dor de cabeça"');
  assert.equal(matches[0].matchedSymptom, 'dor de cabeça');

  sandbox.window.searchCommandPalette('sangramento');
  matches = runExpr('cmdMatches');
  assert.ok(['go-10', 'upa-27'].includes(matches[0].item.id), 'HPP or HDA must be at the top for "sangramento"');
  assert.equal(matches[0].matchedSymptom, 'sangramento');

  sandbox.window.searchCommandPalette('febre');
  matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.id, 'upa-53', 'Sepse must be #1 for "febre"');
  assert.equal(matches[0].matchedSymptom, 'febre');
});

test('Prompt 3: Mobile thumb-zone bottom bar, 48x48 touch targets, haptics, 1s emerald state, and 1.8s Toast', () => {
  assert.ok(htmlContent.includes('id="mobileBottomBar"'), 'Mobile floating bottom bar must exist');
  assert.ok(htmlContent.includes('Ctrl+K Busca'), 'Mobile bottom bar must contain Ctrl+K Busca');
  assert.ok(htmlContent.includes('Voltar ao Topo'), 'Mobile bottom bar must contain Voltar ao Topo');
  assert.ok(htmlContent.includes('min-height: 48px'), '48px min-height must be enforced in mobile CSS');
  assert.ok(htmlContent.includes('min-width: 48px'), '48px min-width must be enforced in mobile CSS');

  const { elements, vibrateCalls, runExpr } = extractScriptAndRun();
  runExpr('copyConduta(0)');
  assert.equal(vibrateCalls.length, 1, 'navigator.vibrate must be called on copyConduta');
  assert.deepEqual(Array.from(vibrateCalls[0]), [40], 'navigator.vibrate([40]) must be triggered');
  assert.equal(elements.toastMsg.textContent, '✅ Conduta copiada com sucesso!');
});

test('Desktop Workstation Refactor, Column Resizers & Weight Calculator Exclusion', () => {
  // Verify workstation grid CSS & anti-slop clinical palette
  assert.ok(htmlContent.includes('grid-template-columns: var(--sidebar-width, 232px) var(--list-width, 460px) 6px minmax(360px, 1fr)'), 'Must define workstation columns with fixed sidebar and resizable list splitter');
  assert.equal(htmlContent.includes('id="resizerSidebar"'), false, 'First column must be fixed in width without #resizerSidebar');
  assert.ok(htmlContent.includes('id="resizerList"'), 'Must include #resizerList drag splitter');
  assert.ok(htmlContent.includes('.power-action-btn'), 'Must style .power-action-btn in top-right cockpit bar');
  assert.ok(htmlContent.includes('#0b0e14'), 'Must include #0b0e14 deep clinical slate');
  assert.ok(htmlContent.includes('#111620'), 'Must include #111620 clinical surface');
  assert.ok(htmlContent.includes('#182030'), 'Must include #182030 elevated surface');
  assert.ok(htmlContent.includes('#10b981'), 'Must include #10b981 Monitor Green');
  assert.ok(htmlContent.includes('#f59e0b'), 'Must include #f59e0b Alert Amber');
  assert.ok(htmlContent.includes('#ef4444'), 'Must include #ef4444 Critical Red');
  assert.ok(htmlContent.includes('#0284c7'), 'Must include #0284c7 Technical Cyan');

  // Verify Weight Calculator is completely removed
  assert.equal(htmlContent.includes('quickWeightInput'), false, 'quickWeightInput must be completely removed');
  assert.equal(htmlContent.includes('dosesOverlay'), false, 'dosesOverlay must be completely removed');
  assert.equal(htmlContent.includes('openDosesModal'), false, 'openDosesModal must be completely removed');
  assert.equal(htmlContent.includes('Calculadora Peso'), false, 'Calculadora Peso button must be removed');

  // Verify J/K navigation, 1/2/3 copy, column resizing, and Modo Consulta vs Modo Treino
  const { sandbox, elements, runExpr } = extractScriptAndRun();
  assert.equal(runExpr('selectedProtocolIndex'), 0, 'Protocol 0 must be selected by default on startup');

  // Test interactive column resizing
  const updatedWidths = sandbox.window.setColumnWidths({ sidebarWidth: 260, listWidth: 540 });
  assert.equal(updatedWidths.sidebarWidth, 260);
  assert.equal(updatedWidths.listWidth, 540);
  assert.equal(sandbox.document.documentElement.style._props['--sidebar-width'], '260px');
  assert.equal(sandbox.document.documentElement.style._props['--list-width'], '540px');

  const resetWidths = sandbox.window.resetColumnWidths();
  assert.equal(resetWidths.sidebarWidth, 232);
  assert.equal(resetWidths.listWidth, 460);

  const nextIdx = runExpr('navigateProtocolList(1)');
  assert.equal(nextIdx, 1, 'navigateProtocolList(1) (J / ArrowDown) must advance to protocol 1');
  assert.equal(runExpr('currentDrawerIndex'), 1, 'Cockpit right column must display protocol 1');

  const prevIdx = runExpr('navigateProtocolList(-1)');
  assert.equal(prevIdx, 0, 'navigateProtocolList(-1) (K / ArrowUp) must return to protocol 0');

  // Test 1, 2, 3 power copy actions
  runExpr('triggerPowerCopy(1)');
  assert.equal(elements.toastMsg.textContent, '✅ Snippet completo copiado com sucesso!');

  runExpr('triggerPowerCopy(2)');
  assert.equal(elements.toastMsg.textContent, '✅ Conduta copiada com sucesso!');

  runExpr('triggerPowerCopy(3)');
  assert.equal(elements.toastMsg.textContent, '✅ Receita copiada com sucesso!');

  // Test Modo Consulta vs Modo Treino
  runExpr("setWorkstationMode('treino')");
  assert.equal(runExpr('workstationMode'), 'treino');
  assert.equal(runExpr('currentDrawerTab'), 'interactive', 'Treino mode must switch PEP protocol to interactive tab');

  runExpr("setWorkstationMode('consulta')");
  assert.equal(runExpr('workstationMode'), 'consulta');
  assert.equal(runExpr('currentDrawerTab'), 'pep', 'Consulta mode must switch PEP protocol back to full snippet tab');

  // Test (?) Shortcuts modal
  runExpr('openShortcutsModal()');
  assert.equal(elements.shortcutsOverlay.classList.contains('open'), true, 'openShortcutsModal must open shortcuts modal');
  assert.equal(elements.shortcutsOverlay.classList.contains('open'), true);
  runExpr('closeShortcutsModal()');
  assert.equal(elements.shortcutsOverlay.classList.contains('open'), false, 'closeShortcutsModal must close shortcuts modal');
});

test('Preceptor V2.0 Audit: All 22 Clinical Skills cards upgraded, deduplicated, and interactive in 05_Habilidades_Clinicas, snippets_hab.json, snippets_todos.json, and index.html', () => {
  const { elements, runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const habItems = allData.filter((d: any) => d.mod_id === 'hab');
  assert.equal(habItems.length, 22, 'Must have all 22 Clinical Skills cards in index.html');

  const habJsonPath = path.resolve(process.cwd(), 'snippets/snippets_hab.json');
  const habJson = JSON.parse(fs.readFileSync(habJsonPath, 'utf8'));
  assert.equal(habJson.length, 22, 'snippets_hab.json must have 22 cards');

  const todosJsonPath = path.resolve(process.cwd(), 'snippets/snippets_todos.json');
  const todosJson = JSON.parse(fs.readFileSync(todosJsonPath, 'utf8'));
  assert.equal(todosJson.length, 105, 'snippets_todos.json must have 105 items synchronized with index.html');

  for (const item of habItems) {
    assert.ok(item.trigger && item.trigger.startsWith(';hab-'), `Card ${item.id} must have a ;hab-* trigger`);
    assert.ok(item.anchor && item.anchor.length > 20, `Card ${item.id} must have a V2.0 anchor sequence`);
    assert.ok(item.pre_porta && item.pre_porta.includes('1. O QUE NÃO ESQUECER'), `Card ${item.id} pre_porta must include V2.0 Preceptor structure`);
    assert.ok(item.pre_porta.includes('COMO REGISTRAR NO PRONTUÁRIO'), `Card ${item.id} pre_porta must include ready-to-copy clinical record`);
    assert.equal(item.pre_porta.includes('1. 1.'), false, `Card ${item.id} pre_porta must not contain double numbering "1. 1."`);
    assert.equal(item.pre_porta.includes('2. 2.'), false, `Card ${item.id} pre_porta must not contain double numbering "2. 2."`);
    assert.ok(item.registro_body && item.registro_body.length > 200, `Card ${item.id} must have extracted interactive registro_body`);
    assert.ok(Array.isArray(item.checklist_sections) && item.checklist_sections.length >= 3, `Card ${item.id} must have structured checklist sections`);
    const hasV2Section = item.checklist_sections.some((s: any) => s.title.includes('Upgrade Preceptor V2.0'));
    assert.equal(hasV2Section, true, `Card ${item.id} must include Upgrade Preceptor V2.0 checklist section`);
    assert.ok(Array.isArray(item.pitfalls) && item.pitfalls.length >= 4, `Card ${item.id} must have Red Flags + Pitfalls populated`);

    // Ensure pitfalls have zero duplicate titles and zero raw LaTeX or markdown asterisk artifacts
    const pitTitles = item.pitfalls.map((p: any) => String(p.title).toLowerCase().trim());
    assert.equal(new Set(pitTitles).size, pitTitles.length, `Card ${item.id} must not have duplicate pitfalls`);
    for (const p of item.pitfalls) {
      assert.equal(/\\(ge|le|times|text|mathbf|circ|%)|\*/.test(p.title), false, `Card ${item.id} pitfall title must not contain raw LaTeX or *: ${p.title}`);
      assert.equal(/\\(ge|le|times|text|mathbf|circ|%)|\*/.test(p.detail), false, `Card ${item.id} pitfall detail must not contain raw LaTeX or *: ${p.detail}`);
      assert.equal(p.title.includes('Imanência'), false, `Card ${item.id} must use "Iminência" instead of "Imanência"`);
    }
    assert.equal(/\\(ge|le|times|text|mathbf|circ|%)|\*/.test(item.pre_porta), false, `Card ${item.id} pre_porta must not contain raw LaTeX or *`);

    // Verify corresponding markdown file on disk
    const mdFull = path.resolve(process.cwd(), item.path);
    const mdText = fs.readFileSync(mdFull, 'utf8');
    assert.ok(mdText.includes('## 🎯 1. O QUE NÃO ESQUECER'), `${item.path} must have V2.0 section 1`);
    assert.ok(mdText.includes('## 🧠 2. MNEMÔNICO / REGRA DE OURO'), `${item.path} must have V2.0 section 2`);
    assert.ok(mdText.includes('## 🛠️ 3. COREOGRAFIA / PASSO A PASSO TÉCNICO'), `${item.path} must have V2.0 section 3`);
    assert.ok(mdText.includes('## 🚨 4. RED FLAGS'), `${item.path} must have V2.0 section 4`);
    assert.ok(mdText.includes('## 📝 5. COMO REGISTRAR NO PRONTUÁRIO'), `${item.path} must have V2.0 section 5`);
    assert.ok(mdText.includes('## ⚠️ 6. ARMADILHAS DO INTERNO'), `${item.path} must have V2.0 section 6`);
    assert.ok(mdText.includes('## ✅ 7. CHECKLIST PÓS-ATENDIMENTO'), `${item.path} must have V2.0 section 7`);
  }

  // Test opening a Habilidade card (index 83 = hab-1), switching to interactive Registro PEP, hiding + Carrinho, and 1/2/3 shortcuts
  runExpr("openInspector(83, 'registro')");
  assert.equal(runExpr('currentDrawerTab'), 'registro', 'openInspector(83, "registro") must activate Registro PEP tab');
  assert.equal(elements.tabCartBtn.style.display, 'none', '#tabCartBtn must be hidden when a Habilidade is open');
  assert.equal(elements.btnAddToCart.style.display, 'none', '#btnAddToCart must be hidden when a Habilidade is open');
  assert.equal(elements.drawerTriggerChip.style.display, 'inline-flex', '#drawerTriggerChip must be visible for Habilidades');

  runExpr('triggerPowerCopy(2)');
  assert.equal(elements.toastMsg.textContent, '✅ Registro PEP copiado com sucesso!', 'Shortcut 2 on Habilidade must copy Registro PEP');
});

test('Padrão Ouro PEP v2.0: All 83 PEP protocols (16 GO + 47 UPA + 7 Enfermaria + 13 Pediatria) have bipartite Conduta, Diretriz/Guia, and Outpatient Receitas', () => {
  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');
  assert.equal(pepItems.length, 83, 'Must have all 83 PEP protocols in index.html');

  const goItems = pepItems.filter((d: any) => d.mod_id === 'go');
  const upaItems = pepItems.filter((d: any) => d.mod_id === 'upa');
  const enfItems = pepItems.filter((d: any) => d.mod_id === 'enf');
  const pedItems = pepItems.filter((d: any) => d.mod_id === 'ped');

  assert.equal(goItems.length, 16, 'Must have 16 GO protocols');
  assert.equal(upaItems.length, 47, 'Must have 47 UPA protocols');
  assert.equal(enfItems.length, 7, 'Must have 7 Enfermaria protocols');
  assert.equal(pedItems.length, 13, 'Must have 13 Pediatria protocols');

  for (const item of pepItems) {
    assert.equal(item.has_split, true, `PEP protocol ${item.id} (${item.trigger}) must have bipartite # PLANO / CONDUTA split`);
    assert.ok(item.conduta_body && item.conduta_body.length > 250, `PEP protocol ${item.id} must have complete conduta_body`);
    assert.equal(item.has_guia, true, `PEP protocol ${item.id} (${item.trigger}) must have Guia/Diretriz populated`);
    assert.ok(item.guia_body && item.guia_body.length > 400, `PEP protocol ${item.id} must have substantive guia_body`);
  }

  // All 10 Pediatria protocols must have weight-based outpatient/discharge Receitas
  for (const item of pedItems) {
    assert.equal(item.has_receita, true, `Pediatria protocol ${item.id} (${item.trigger}) must have Receita Domiciliar / Alta`);
    assert.ok(item.receita_body && item.receita_body.length > 250, `Pediatria protocol ${item.id} must have complete receita_body`);
  }

  const totalReceitas = pepItems.filter((d: any) => d.has_receita && d.receita_body.length > 250).length;
  assert.ok(totalReceitas >= 49, `Expected at least 49 PEP protocols with complete Receita Domiciliar / Alta, found ${totalReceitas}`);
});

test('Personalizar v2.0 Engine: Balanced brackets, zero DD/MM/AAAA choice splits, and clean choice groups across all 74 PEP protocols', () => {
  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');

  // Verify DD/MM/AAAA and DD/MM are never split into choices
  const dateFullChoices = Array.from<string>(runExpr("splitTopLevelChoices('DD/MM/AAAA')"));
  assert.deepEqual(dateFullChoices, ['DD/MM/AAAA'], 'DD/MM/AAAA must never be split into DD, MM, AAAA pills');

  const dateShortChoices = Array.from<string>(runExpr("splitTopLevelChoices('DD/MM')"));
  assert.deepEqual(dateShortChoices, ['DD/MM'], 'DD/MM must never be split into DD, MM pills');

  // Verify nested brackets inside options are kept intact by parseBalancedBrackets + splitTopLevelChoices
  const usgChoices = Array.from<string>(
    runExpr("splitTopLevelChoices('Solicitada hoje / Realizada em [DD/MM] com CCN de [ ] mm = IG USG: [ ]s[ ]d')")
  );
  assert.deepEqual(usgChoices, [
    'Solicitada hoje',
    'Realizada em [DD/MM] com CCN de [ ] mm = IG USG: [ ]s[ ]d'
  ]);

  // Verify every bracket across all 74 PEP protocols parses cleanly with zero DD/MM/AAAA or '...' pills
  for (const item of pepItems) {
    const lines = String(item.pep_body).split('\n');
    for (const line of lines) {
      const escaped = JSON.stringify(line);
      const tokens = Array.from<any>(runExpr(`parseBalancedBrackets(${escaped})`));
      for (const tok of tokens) {
        if (tok.type === 'bracket') {
          const choices = Array.from<string>(runExpr(`splitTopLevelChoices(${JSON.stringify(tok.inner)})`));
          if (choices.length > 1) {
            for (const ch of choices) {
              assert.notEqual(ch, 'DD', `Protocol ${item.id} must not produce a 'DD' choice pill in line: ${line}`);
              assert.notEqual(ch, 'MM', `Protocol ${item.id} must not produce a 'MM' choice pill in line: ${line}`);
              assert.notEqual(ch, 'AAAA', `Protocol ${item.id} must not produce an 'AAAA' choice pill in line: ${line}`);
              assert.notEqual(ch, '...', `Protocol ${item.id} must not produce a '...' choice pill in line: ${line}`);
            }
          }
        }
      }
    }
  }
});

test('Editorial Diretrizes & Raciocínio Clínico: Formatted HTML renderer and structured "Por Quê" sections across all 74 PEP protocols', () => {
  assert.ok(htmlContent.includes('id="drawerGuiaPanel"'), 'Must include dedicated #drawerGuiaPanel for formatted Diretrizes');
  assert.ok(htmlContent.includes('class="guia-section-card'), 'Must define .guia-section-card editorial styling');

  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');

  // Verify inline formatter converts bold, code pills, and LaTeX clinical symbols cleanly
  const formatted = String(runExpr("formatGuiaInlineHtml('Diluir `$MgSO_4$` **4 g** $\\\\rightarrow$ `100 mL/h`')"));
  assert.ok(formatted.includes('<code class="guia-inline-code">MgSO₄</code>'), 'Must format inline code and MgSO4 symbol');
  assert.ok(formatted.includes('<strong class="guia-strong">4 g</strong>'), 'Must format bold text');
  assert.ok(formatted.includes('→'), 'Must convert LaTeX rightarrow to →');

  // Verify all 74 PEP protocols have multi-section structured Diretrizes explaining "Por Que"
  for (const item of pepItems) {
    assert.ok(item.guia_body.includes('### '), `Protocol ${item.id} must have structured ### sections in guia_body`);
    assert.ok(
      item.guia_body.includes('Por Que') || item.guia_body.includes('Por quê') || item.guia_body.includes('Por que'),
      `Protocol ${item.id} must explain clinical rationale ("Por Que") in guia_body`
    );
    assert.equal(item.guia_body.includes('```mermaid'), false, `Protocol ${item.id} must not contain raw mermaid code in guia_body`);
    assert.equal(item.guia_body.includes('[!IMPORTANT]'), false, `Protocol ${item.id} must not contain raw GitHub callout syntax in guia_body`);
  }
});

test('Personalizar v3.0 & Modular Architecture: Sub-inputs restored, 49 Receitas unified in pep_body, weight-based dose helper, and /src modules', () => {
  // 1. Verify modular /src architecture files exist
  const requiredModules = [
    'src/styles/cockpit.css',
    'src/data/clinical_data.ts',
    'src/engine/personalizar.ts',
    'src/engine/diretrizes.ts',
    'src/engine/search.ts',
    'src/engine/workstation.ts'
  ];
  for (const relPath of requiredModules) {
    const full = path.resolve(process.cwd(), relPath);
    assert.equal(fs.existsSync(full), true, `Modular file ${relPath} must exist`);
  }

  const { sandbox, runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');

  // 2. Verify zero stripped choice brackets ([Nega /], [Ausente //10 min], or choice options ending with ':')
  for (const item of pepItems) {
    assert.equal(item.pep_body.includes('[Nega /]'), false, `Protocol ${item.id} must not have stripped [Nega /]`);
    assert.equal(item.pep_body.includes('//10 min]'), false, `Protocol ${item.id} must not have stripped //10 min]`);
    const lines = String(item.pep_body).split('\n');
    for (const line of lines) {
      const tokens = Array.from<any>(runExpr(`parseBalancedBrackets(${JSON.stringify(line)})`));
      for (const tok of tokens) {
        if (tok.type === 'bracket') {
          const choices = Array.from<string>(runExpr(`splitTopLevelChoices(${JSON.stringify(tok.inner)})`));
          if (choices.length > 1) {
            for (const ch of choices) {
              assert.equal(ch.trim().endsWith(':'), false, `Choice option "${ch}" in protocol ${item.id} must include an inline [ ] sub-input after colon`);
            }
          }
        }
      }
    }
  }

  // 3. Verify all 49 protocols with has_receita: true have their prescription unified inside pep_body
  const receitaItems = pepItems.filter((d: any) => d.has_receita);
  assert.ok(receitaItems.length >= 49, 'Must have at least 49 protocols with has_receita: true');
  for (const item of receitaItems) {
    assert.ok(
      /PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL/i.test(item.pep_body),
      `Protocol ${item.id} (${item.title}) with has_receita: true must include its prescription section inside pep_body for Personalizar customization`
    );
  }

  // 4. Verify inline weight-based dose calculator helper in Personalizar v3.0
  const doses12kg = sandbox.window.computeWeightBasedDoses(12);
  assert.ok(doses12kg, 'computeWeightBasedDoses(12) must return calculated doses');
  assert.equal(doses12kg.dipironaGotas, 10, '12 kg Dipirona gotas (500mg/mL) must be 10 gotas');
  assert.equal(doses12kg.dipironaMg, 240, '12 kg Dipirona mg (20 mg/kg) must be 240 mg');
  assert.equal(doses12kg.paracetamolGotas, 12, '12 kg Paracetamol gotas (200mg/mL) must be 12 gotas');
  assert.equal(doses12kg.ibuprofenoGotas100, 12, '12 kg Ibuprofeno 100mg/mL must be 12 gotas');
  assert.equal(doses12kg.amoxi50Ml8h, '4,0', '12 kg Amoxicilina 50mg/kg/dia (250mg/5mL) must be 4,0 mL de 8/8h');
  assert.equal(doses12kg.amoxi90Ml12h, '6,8', '12 kg Amoxicilina 90mg/kg/dia (400mg/5mL) must be 6,8 mL de 12/12h');
  assert.equal(doses12kg.prednisolonaMlDia, '4,0', '12 kg Prednisolona 1mg/kg/dia (3mg/mL) must be 4,0 mL/dia');
  assert.equal(typeof sandbox.window.focusNextEmptyInteractiveInput, 'function', 'focusNextEmptyInteractiveInput must be exposed on window');
});



test('Compositor Modular de Prescrição: Carrinho de Prescrição em 1 Clique (#tabCartBtn, #btnAddToCart, #drawerCartPanel) com medicamentos categorizados e sem orientações não-medicamentosas', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(html.includes('id="btnAddToCart"'), 'Must include #btnAddToCart button in drawer footer');
  assert.ok(html.includes('id="tabCartBtn"'), 'Must include #tabCartBtn tab in drawer tabs');
  assert.ok(html.includes('id="drawerCartPanel"'), 'Must include #drawerCartPanel dedicated UI panel');
  assert.ok(html.includes('function addCustomItemToCart'), 'Must define addCustomItemToCart function in JS');
  assert.ok(html.includes('function copyPrescriptionCart'), 'Must define copyPrescriptionCart function in JS');

  // Verify non-prescription buttons are removed
  assert.equal(html.includes('+ Hidratação/Repouso'), false, 'Must not include + Hidratação/Repouso in quick cart buttons');
  assert.equal(html.includes('+ Sinais de Alarme'), false, 'Must not include + Sinais de Alarme in quick cart buttons');

  // Verify clinical categories and real medications with box/bottle quantity & duration are present
  const expectedMedButtons = [
    '+ Dipirona 1g',
    '+ Paracetamol 750mg',
    '+ Ibuprofeno 600mg',
    '+ Cetoprofeno 100mg',
    '+ Prednisolona 20mg',
    '+ Ciclobenzaprina 5mg',
    '+ Orfenadrina Comp.',
    '+ Ondansetrona 8mg',
    '+ Escopolamina + Dip.',
    '+ Omeprazol 20mg',
    '+ Simeticona 125mg',
    '+ SRO OMS',
    '+ Loratadina 10mg',
    '+ Dexclorfeniramina 2mg',
    '+ Levodropropizina Xpe',
    '+ Lavagem Nasal SF',
    '+ Amoxicilina 500mg',
    '+ Amox + Clavulanato',
    '+ Azitromicina 500mg',
    '+ Cefalexina 500mg'
  ];
  for (const btnLabel of expectedMedButtons) {
    assert.ok(html.includes(btnLabel), `Quick cart presets must include medication button "${btnLabel}"`);
  }

  const { runExpr } = extractScriptAndRun();
  assert.equal(runExpr("isNonMedicationCartEntry('Sinais de Alarme: febre > 72h ou dispneia.')"), true, 'Must filter out Sinais de Alarme from cart import');
  assert.equal(runExpr("isNonMedicationCartEntry('Repouso domiciliar e hidratação oral abundante.')"), true, 'Must filter out Repouso/Hidratação from cart import');
  assert.equal(runExpr("isNonMedicationCartEntry('Amoxicilina 500 mg (cápsulas) — 1 caixa (21 cápsulas): Tomar 1 cápsula VO a cada 8 horas por 7 dias.')"), false, 'Must keep real medications in cart import');

  // Verify 1-click Medical Documents & Red Room Dilutions generator
  const atestadoDoc = String(runExpr("generateMedicalDoc('atestado')"));
  assert.ok(atestadoDoc.includes('ATESTADO MÉDICO'), 'generateMedicalDoc("atestado") must generate Atestado Médico');
  const declDoc = String(runExpr("generateMedicalDoc('declaracao')"));
  assert.ok(declDoc.includes('DECLARAÇÃO DE COMPARECIMENTO'), 'generateMedicalDoc("declaracao") must generate Declaração de Comparecimento');
  const encDoc = String(runExpr("generateMedicalDoc('encaminhamento')"));
  assert.ok(encDoc.includes('GUIA DE ENCAMINHAMENTO MÉDICO'), 'generateMedicalDoc("encaminhamento") must generate Guia de Encaminhamento');
  const dilDoc = String(runExpr("generateMedicalDoc('diluicoes')"));
  assert.ok(dilDoc.includes('NORADRENALINA') && dilDoc.includes('Fentanil'), 'generateMedicalDoc("diluicoes") must generate Red Room DVA & Sedation dilutions');
});

test('Hospital PEP Header Architecture: All 16 GO headers, 83 PEP Anamnese/Exame Clínico splits, and 1-click PEP Box Copy Bar', () => {
  assert.equal(MODULE_COUNTS.total, 105);
  assert.equal(MODULE_COUNTS.pep, 83);
  assert.equal(MODULE_COUNTS.go, 16);
  assert.equal(MODULE_COUNTS.upa, 47);
  assert.equal(MODULE_COUNTS.enf, 7);
  assert.equal(MODULE_COUNTS.ped, 13);
  assert.equal(MODULE_COUNTS.hab, 22);

  assert.ok(htmlContent.includes('id="pepBoxCopyBar"'), 'Must include #pepBoxCopyBar toolbar inside drawer body');
  assert.ok(htmlContent.includes('id="btnCopyAnamneseBar"'), 'Must include #btnCopyAnamneseBar button');
  assert.ok(htmlContent.includes('id="btnCopyExameBar"'), 'Must include #btnCopyExameBar button');

  const { sandbox, elements, vibrateCalls, runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');
  const goItems = pepItems.filter((d: any) => d.mod_id === 'go');

  // 1. All 16 GO protocols adopt hospital-native vertical header + # EXAME CLÍNICO split
  assert.equal(goItems.length, 16);
  for (const item of goItems) {
    const body = String(item.pep_body || '');
    for (const tag of ['### ', '# ID:', '# AP:', 'PAT:', 'MED:', 'HAB:', 'CX:', 'ALER:', 'HF:', '# CASO:', 'HMA:', '# EXAME CLÍNICO']) {
      assert.ok(body.includes(tag), `GO protocol ${item.id} must include hospital PEP tag "${tag}"`);
    }
  }

  // 2. All 83 PEP protocols split cleanly in both TS pure engine and browser JS engine
  for (let i = 0; i < pepItems.length; i++) {
    const item = pepItems[i];
    const tsBodies = extractPepBodies(item.pep_body, item);
    const jsBodies = runExpr(`getResolvedProtocolBodies(${i})`);

    for (const [label, b] of [['TS', tsBodies], ['JS', jsBodies]] as const) {
      assert.ok(b.anamnese_body && b.anamnese_body.length > 30, `${label} ${item.id} must extract non-empty anamnese_body`);
      assert.ok(b.exame_body && b.exame_body.length > 20, `${label} ${item.id} must extract non-empty exame_body`);
      assert.ok(b.conduta_body && b.conduta_body.length > 100, `${label} ${item.id} must extract non-empty conduta_body`);
      assert.equal(b.anamnese_body.includes('# EXAME CLÍNICO'), false, `${label} ${item.id} anamnese_body must stop before # EXAME CLÍNICO`);
      assert.equal(b.exame_body.startsWith('# EXAME CLÍNICO'), false, `${label} ${item.id} exame_body must omit # EXAME CLÍNICO heading for direct PEP box paste`);
      assert.equal(b.exame_body.includes('# PLANO / CONDUTA'), false, `${label} ${item.id} exame_body must stop before # PLANO / CONDUTA`);
    }
  }

  // 3. Test 1-click copyAnamnese and copyExameClinico & toolbar visibility toggling
  runExpr("openInspector(0, 'pep')");
  assert.equal(elements.pepBoxCopyBar.style.display, 'flex', '#pepBoxCopyBar must be visible on PEP tab');

  vibrateCalls.length = 0;
  sandbox.window.copyAnamnese(0);
  assert.equal(vibrateCalls.length, 1);
  assert.equal(elements.toastMsg.textContent, '✅ Anamnese copiada para o PEP!');

  vibrateCalls.length = 0;
  sandbox.window.copyExameClinico(0);
  assert.equal(vibrateCalls.length, 1);
  assert.equal(elements.toastMsg.textContent, '✅ Exame Clínico copiado para o PEP!');

  runExpr("switchDrawerTab('guia')");
  assert.equal(elements.pepBoxCopyBar.style.display, 'none', '#pepBoxCopyBar must be hidden on Diretrizes tab');

  runExpr("openInspector(83, 'preporta')");
  assert.equal(elements.pepBoxCopyBar.style.display, 'none', '#pepBoxCopyBar must be hidden on Habilidades Clínicas');
});

test('UI/UX Refactor & Non-Copied MACHO-S Hint: Typography, Clean Cards, Cart Styling, Jump Anchors & Box Checkmarks', () => {
  const cssContent = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/cockpit.css'), 'utf8');

  // 1. Typography & CSS fixes
  assert.ok(htmlContent.includes('Plus Jakarta Sans'), 'index.html must load Plus Jakarta Sans font');
  assert.ok(htmlContent.includes('JetBrains Mono'), 'index.html must load JetBrains Mono font');
  assert.ok(cssContent.includes('.btn-outline'), 'cockpit.css must define .btn-outline to fix unstyled cart/action buttons');
  assert.ok(cssContent.includes('.pep-noncopy-hint'), 'cockpit.css must define .pep-noncopy-hint');
  assert.ok(cssContent.includes('.pep-box-copy-btn.is-box-done'), 'cockpit.css must define .is-box-done checkmark state');

  // 2. Pseudo-telemetry & redundant card badge cleanup
  assert.equal(htmlContent.includes('ESTAÇÃO DIAGNÓSTICA'), false, 'Sidebar must not contain decorative ESTAÇÃO DIAGNÓSTICA label');
  assert.equal(htmlContent.includes('PLANTÃO ATIVO'), false, 'Sidebar must not contain decorative PLANTÃO ATIVO status');
  assert.equal(htmlContent.includes('>Bipartido</span>'), false, 'Cards must not repeat redundant Bipartido flag');
  assert.equal(htmlContent.includes('>Diretriz</span>'), false, 'Cards must not repeat redundant Diretriz flag');
  assert.ok(htmlContent.includes('>Receita</span>'), 'Cards with Receita must preserve the Receita flag');
  assert.ok(htmlContent.includes('id="pepBoxJumpGroup"'), 'Colar no PEP bar must include section jump anchors');

  // 3. MACHO-S visual hint on # AP: in Personalizar (never copied into PEP clipboard output)
  const { sandbox, elements, runExpr } = extractScriptAndRun();
  assert.equal(typeof sandbox.window.scrollPersonalizarSection, 'function', 'scrollPersonalizarSection must be exposed on window');

  runExpr("openInspector(4, 'interactive')");
  assert.equal(elements.pepBoxJumpGroup.style.display, 'inline-flex', 'Jump anchors must show when Personalizar tab is active');

  const lines = Array.from<any>(elements.interactiveRendered.children);
  const apLine = lines.find((l: any) => String(l.dataset?.rawLine || '').trim().startsWith('# AP:'));
  assert.ok(apLine, 'GO protocol #4 must render an # AP: line in Personalizar');
  const hintNode = Array.from<any>(apLine.children).find((c: any) => c.classList && c.classList.contains('pep-noncopy-hint'));
  assert.ok(hintNode, '# AP: line must contain .pep-noncopy-hint visual reminder');
  assert.ok(String(hintNode.textContent).includes('MACHO-S na pergunta'), 'Visual hint must remind MACHO-S interview order');

  // Verify serialized output keeps hospital AP order and completely omits MACHO-S
  const serialized = String(runExpr('serializeInteractiveDOM()'));
  assert.equal(serialized.includes('MACHO-S'), false, 'serializeInteractiveDOM() must never leak MACHO-S visual hint into copied text');
  assert.ok(serialized.includes('# AP:'), 'Serialized output must preserve # AP: header');
  assert.ok(serialized.includes('PAT:'), 'Serialized output must preserve hospital PAT: order');

  // 4. Session box copied checkmark tracking & reset
  sandbox.window.copyAnamnese(4);
  assert.equal(elements.btnCopyAnamneseBar.classList.contains('is-box-done'), true, 'copyAnamnese must mark Anamnese box as copied');
  runExpr('resetInteractiveCurrent()');
  assert.equal(elements.btnCopyAnamneseBar.classList.contains('is-box-done'), false, 'resetInteractiveCurrent must clear copied box checkmarks');
});

test('Parte 1 - src/data/clinical_data & src/engine/workstation: contagem sincronizada e severidade sev-tecnica', () => {
  const todosJsonPath = path.resolve(process.cwd(), 'snippets/snippets_todos.json');
  const todos = JSON.parse(fs.readFileSync(todosJsonPath, 'utf8')) as ClinicalProtocolItem[];
  const summary = summarizeProtocolCounts(todos);

  assert.deepEqual(summary, MODULE_COUNTS, 'summarizeProtocolCounts must match MODULE_COUNTS across all 105 items');
  assert.equal(getClinicalSeverity(null).cls, 'sev-rotina');
  assert.equal(getClinicalSeverity({ id: 'hab-1', mod_id: 'hab', category: 'Semiologia' }).cls, 'sev-tecnica');
  assert.equal(getClinicalSeverity({ id: 'hab-1', mod_id: 'hab', category: 'Semiologia' }).label, 'TÉCNICA');
  assert.equal(getClinicalSeverity({ id: 'upa-78', mod_id: 'upa', category: 'Geral' }).cls, 'sev-critico');
  assert.equal(getClinicalSeverity({ id: 'ped-80', mod_id: 'ped', category: 'Respiratorio' }).cls, 'sev-critico');
  assert.equal(getClinicalSeverity({ id: 'upa-16', mod_id: 'upa', category: 'Triagem e Ficha Mestra' }).cls, 'sev-rotina');
  assert.equal(getClinicalSeverity({ id: 'upa-17', mod_id: 'upa', category: 'Respiratorio' }).cls, 'sev-urgente');
  assert.ok(CRITICAL_PROTOCOL_IDS.has('ped-80') && CRITICAL_PROTOCOL_IDS.has('upa-76'));
});

test('Parte 1 - src/engine/personalizar: parser balanceado, escolhas curtas, extração case-insensitive e travas de segurança ponderal', () => {
  // 1. Parser com colchete desbalanceado antes de bloco válido
  const unbalanced = parseBalancedBrackets('PA [sem fechar e conduta [Sim / Não]');
  assert.equal(unbalanced.some(t => t.type === 'bracket' && t.inner === 'Sim / Não'), true);

  // 2. splitTopLevelChoices: opções curtas vs abreviações/datas clínicas protegidas
  assert.deepEqual(splitTopLevelChoices('Sim/Não'), ['Sim', 'Não']);
  assert.deepEqual(splitTopLevelChoices('VO/EV/IM'), ['VO', 'EV', 'IM']);
  assert.deepEqual(splitTopLevelChoices('Leve/Moderada/Grave'), ['Leve', 'Moderada', 'Grave']);
  assert.deepEqual(splitTopLevelChoices('DD/MM/AAAA'), ['DD/MM/AAAA']);
  assert.deepEqual(splitTopLevelChoices('mg/dL'), ['mg/dL']);
  assert.deepEqual(splitTopLevelChoices('S/N'), ['S/N']);
  assert.deepEqual(splitTopLevelChoices('12/2026'), ['12/2026']);

  // 3. Travas de segurança em computeWeightBasedDoses
  assert.equal(computeWeightBasedDoses(Number.NaN), null);
  assert.equal(computeWeightBasedDoses(1.9), null);
  assert.equal(computeWeightBasedDoses(151), null);

  const neo3kg = computeWeightBasedDoses(3);
  assert.ok(neo3kg);
  assert.equal(neo3kg.dipironaAllowed, false, 'Dipirona contraindicated < 5 kg');
  assert.equal(neo3kg.dipironaMg, 0, 'Contraindicated Dipirona mg must be zeroed');
  assert.equal(neo3kg.dipironaGotas, 0, 'Contraindicated Dipirona drops must be zeroed');
  assert.equal(neo3kg.dipironaMlSolucao, '0,0', 'Contraindicated Dipirona mL must be zeroed');
  assert.equal(neo3kg.ibuprofenoAllowed, false, 'Ibuprofeno contraindicated < 7 kg');
  assert.equal(neo3kg.ibuprofenoMg, 0, 'Contraindicated Ibuprofeno mg must be zeroed');
  assert.equal(neo3kg.ibuprofenoGotas100, 0);
  assert.equal(neo3kg.ibuprofenoGotas50, 0);
  assert.equal(neo3kg.paracetamolMg, 30, 'Neonatal paracetamol (< 4 kg) uses conservative 10 mg/kg');
  assert.equal(neo3kg.ondansetronaMg, '0,45', 'Low-weight Ondansetrona preserves 2-decimal precision');

  const infant6kg = computeWeightBasedDoses(6);
  assert.ok(infant6kg);
  assert.equal(infant6kg.dipironaAllowed, true);
  assert.equal(infant6kg.dipironaMg, 120);
  assert.equal(infant6kg.ibuprofenoAllowed, false, 'Ibuprofeno still contraindicated at 6 kg (< 7 kg)');
  assert.equal(infant6kg.ibuprofenoMg, 0);

  const child25kg = computeWeightBasedDoses(25);
  assert.ok(child25kg);
  assert.equal(child25kg.ondansetronaMg, '3,8', '25 kg * 0.15 = 3.75 -> 3,8 mg (< 4 mg pediatric cap)');

  const teen35kg = computeWeightBasedDoses(35);
  assert.ok(teen35kg);
  assert.equal(teen35kg.ondansetronaMg, '4,0', 'Pediatrics < 40 kg capped safely at 4,0 mg single dose');

  const adult70kg = computeWeightBasedDoses(70);
  assert.ok(adult70kg);
  assert.equal(adult70kg.dipironaMg, 1000);
  assert.equal(adult70kg.ibuprofenoMg, 400);
  assert.equal(adult70kg.ondansetronaMg, '8,0');

  // 4. extractPepBodies: case-insensitive + PRESCRIÇÃO AMBULATORIAL + delimitação antes de Referências
  const samplePep = [
    '# ID: Teste',
    '# EXAME CLÍNICO:',
    'BEG, corado',
    '# plano / conduta:',
    '1. Hidratação',
    '>> PRESCRIÇÃO AMBULATORIAL:',
    '1. Paracetamol 750 mg',
    '# REFERÊNCIAS:',
    'Diretriz MS'
  ].join('\n');
  const extracted = extractPepBodies(samplePep);
  assert.equal(extracted.anamnese_body, '# ID: Teste');
  assert.equal(extracted.exame_body, 'BEG, corado');
  assert.ok(extracted.conduta_body.startsWith('# plano / conduta:'));
  assert.equal(extracted.receita_body, '1. Paracetamol 750 mg');
});

test('Parte 1 - src/engine/diretrizes: neutralização XSS, código inline preservado, LaTeX clínico e temas', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');

  const xssHtml = formatGuiaInlineHtml('**<script>alert(1)</script>** e `<img onerror=alert(1)>` + **texto *com* asterisco**');
  assert.equal(xssHtml.includes('<script>'), false, 'Raw <script> must be escaped');
  assert.equal(xssHtml.includes('<img'), false, 'Raw <img> inside backticks must be escaped');
  assert.ok(xssHtml.includes('<code class="guia-inline-code">&lt;img onerror=alert(1)&gt;</code>'));
  assert.ok(xssHtml.includes('<strong class="guia-strong">texto <em class="guia-em">com</em> asterisco</strong>'));

  const latexClinical = formatGuiaInlineHtml('Elevação de $\\uparrow$ $Na^+$ e $K^+$ ($\\neq$ placebo); custo $10 a $20 em `$Ca^{2+}$`');
  assert.ok(latexClinical.includes('↑ Na⁺ e K⁺ (≠ placebo)'));
  assert.ok(latexClinical.includes('$10 a $20'), 'Currency ranges with $ must not be stripped');
  assert.ok(latexClinical.includes('<code class="guia-inline-code">Ca²⁺</code>'));

  assert.equal(classifyGuiaSectionTheme('🚫 Não prescrever AINE na gestação').cls, 'theme-danger');
  assert.equal(classifyGuiaSectionTheme('Quando a febre não cede em 48h — Fisiopatologia').cls, 'theme-why');
  assert.equal(classifyGuiaSectionTheme('💊 Farmacologia & Doses de Primeira Linha').cls, 'theme-pharma');
  assert.equal(classifyGuiaSectionTheme('📐 Critérios de Gravidade & Tabela').cls, 'theme-criteria');
});

test('Parte 1 - src/engine/search: normalização de múltiplos espaços e correspondência multi-token', () => {
  assert.equal(normalizeSearchText('  Falta   de   Ar  Aguda '), 'falta de ar aguda');

  const item = {
    _tags_norm: [
      { raw: 'Falta de ar', norm: 'falta de ar', isDirect: true },
      { raw: 'Dor no peito', norm: 'dor no peito', isDirect: false }
    ]
  };

  const exact = findMatchedSymptom(item, 'falta de ar');
  assert.ok(exact && exact.level === 3 && exact.tag === 'Falta de ar');

  const multiToken = findMatchedSymptom(item, 'falta   ar');
  assert.ok(multiToken && multiToken.level === 0.5 && multiToken.tag === 'Falta de ar');

  const multiTokenIndirect = findMatchedSymptom(item, 'dor peito');
  assert.ok(multiTokenIndirect && multiTokenIndirect.tag === 'Dor no peito');

  assert.equal(findMatchedSymptom(item, ' '), null);
  assert.equal(findMatchedSymptom(null, 'febre'), null);
});

test('Parte 2 - Passo A: allData extraído do index.html, ponte window global, XSS no carrinho, sev-tecnica e wsCenterCounter', () => {
  // 1. Verificar que index.html carrega via <script type="module"> e não embute o JSON inline gigante
  assert.ok(htmlContent.includes('<script type="module">'), 'index.html must use <script type="module">');
  assert.ok(htmlContent.includes('./snippets/snippets_todos.json'), 'index.html must load clinical data from ./snippets/snippets_todos.json');
  assert.equal(htmlContent.includes('const allData = [{'), false, 'index.html must no longer embed inline 2 MB allData JSON literal');

  const { sandbox, elements, runExpr } = extractScriptAndRun();

  // 2. Ponte window para handlers inline onclick="..."
  for (const fnName of [
    'openInspector',
    'closeInspector',
    'switchDrawerTab',
    'openCmdPalette',
    'closeCmdPalette',
    'copyConduta',
    'copyReceita',
    'copyAnamnese',
    'copyExameClinico',
    'addCustomItemToCart',
    'removeCartItem',
    'copyPrescriptionCart',
    'generateMedicalDoc'
  ]) {
    assert.equal(typeof sandbox.window[fnName], 'function', `window.${fnName} must be exposed for inline HTML handlers`);
  }

  // 3. Sanitização XSS em renderPrescriptionCartUI
  runExpr("addCustomItemToCart('<img src=x onerror=\"alert(1)\"> Dipirona 1g')");
  const cartHtml = String(elements.cartItemsContainer.innerHTML);
  assert.equal(cartHtml.includes('<img'), false, 'Cart UI must escape HTML tags from item text');
  assert.ok(cartHtml.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));

  // 4. Sincronização do contador desktop #wsCenterCounter e classe .sev-tecnica
  assert.equal(elements.wsCenterCounter.textContent, '83 Protocolos', 'Desktop #wsCenterCounter must initialize to 83 Protocolos');
  const habSev = runExpr("getClinicalSeverity({ id: 'hab-1', mod_id: 'hab', category: 'Semiologia' })");
  assert.equal(habSev.cls, 'sev-tecnica', 'index.html getClinicalSeverity must use sev-tecnica instead of dead sev-info');
});





