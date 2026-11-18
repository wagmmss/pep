import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const htmlPath = path.resolve(process.cwd(), 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

function extractScriptAndRun() {
  const scriptMatch = [...htmlContent.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(m => m[1].includes('const allData ='));
  assert.ok(scriptMatch, 'Main script block must exist in index.html');

  // Minimal DOM mock to run index.html script in Node VM
  const makeEl = () => ({
    style: {},
    dataset: {},
    className: '',
    classList: {
      _set: new Set<string>(),
      add(...cls: string[]) { cls.forEach(c => this._set.add(c)); },
      remove(...cls: string[]) { cls.forEach(c => this._set.delete(c)); },
      toggle(c: string, force?: boolean) {
        if (force === undefined) {
          if (this._set.has(c)) this._set.delete(c);
          else this._set.add(c);
        } else if (force) {
          this._set.add(c);
        } else {
          this._set.delete(c);
        }
      },
      contains(c: string) { return this._set.has(c); }
    },
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    options: [] as any[],
    children: [] as any[],
    childNodes: [] as any[],
    appendChild(child: any) { this.children.push(child); return child; },
    removeChild(child: any) { this.children = this.children.filter(c => c !== child); return child; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    click() {},
    focus() {},
    select() {},
    blur() {},
    scrollIntoView() {}
  });

  const elements: Record<string, any> = {};
  const getEl = (id: string) => {
    if (!elements[id]) elements[id] = makeEl();
    return elements[id];
  };

  const vibrateCalls: any[] = [];
  const mockCards = Array.from({ length: 110 }, (_, idx) => {
    const el = makeEl();
    el.dataset = {
      mod: idx < 19 ? 'go' : idx < 66 ? 'upa' : idx < 75 ? 'enf' : idx < 88 ? 'ped' : 'hab',
      cat: 'Categoria Teste',
      search: ''
    };
    el.style = { display: idx < 88 ? 'flex' : 'none' };
    return el;
  });

  const lsStore: Record<string, string> = {};
  const localStorageMock = {
    getItem: (k: string) => (k in lsStore ? lsStore[k] : null),
    setItem: (k: string, v: string) => { lsStore[k] = String(v); },
    removeItem: (k: string) => { delete lsStore[k]; },
    key: (i: number) => Object.keys(lsStore)[i] ?? null,
    get length() { return Object.keys(lsStore).length; }
  };

  const sandbox: any = {
    window: {
      innerWidth: 1440,
      addEventListener() {},
      removeEventListener() {},
      scrollTo() {}
    },
    document: {
      activeElement: null,
      documentElement: {
        classList: makeEl().classList,
        style: {
          _props: {} as Record<string, string>,
          setProperty(k: string, v: string) { this._props[k] = v; }
        }
      },
      getElementById: getEl,
      querySelector: () => makeEl(),
      querySelectorAll: (sel: string) => (sel === '.card' ? mockCards : []),
      createElement: () => makeEl(),
      createDocumentFragment: () => makeEl(),
      createTextNode: (t: string) => ({ textContent: t }),
      body: makeEl(),
      execCommand: () => true
    },
    navigator: {
      vibrate: (pattern: number[]) => {
        vibrateCalls.push(pattern);
        return true;
      },
      clipboard: {
        writeText: async () => {}
      }
    },
    localStorage: localStorageMock,
    URL: {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {}
    },
    Blob: class MockBlob {
      constructor() {}
    },
    performance,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptMatch[1], sandbox);
  const runExpr = (expr: string) => vm.runInContext(expr, sandbox);
  return { sandbox, elements, vibrateCalls, runExpr, mockCards, lsStore };
}

test('Prompt 1: Semantic search maps tags_sintomas and ranks Asma, DPOC, and EAP at top for "falta de ar"', () => {
  const { sandbox, runExpr } = extractScriptAndRun();
  const allData = runExpr('allData');
  assert.equal(allData.length, 110, 'All 110 protocols (88 PEP + 22 Habilidades) must be preserved');

  const pepCount = Array.from(allData).filter((x: any) => x.mod_id !== 'hab').length;
  const habCount = Array.from(allData).filter((x: any) => x.mod_id === 'hab').length;
  assert.equal(pepCount, 88, 'Must have exactly 88 PEP protocols');
  assert.equal(habCount, 22, 'Must have exactly 22 Habilidades Clínicas cards');

  const t0 = performance.now();
  sandbox.window.searchCommandPalette('falta de ar');
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 16, `Search latency (${elapsed.toFixed(2)}ms) must be under 16ms`);

  const matches = runExpr('cmdMatches');
  assert.ok(matches.length >= 3, 'Must return at least 3 matches for "falta de ar"');

  const top3Triggers = Array.from(matches.slice(0, 3), (m: any) => m.item.trigger);
  assert.deepEqual(top3Triggers, [';asma', ';dpoc', ';eap'], 'Top 3 protocols for "falta de ar" must be Asma (;asma), DPOC (;dpoc), and EAP (;eap)');

  matches.slice(0, 3).forEach((m: any) => {
    assert.equal(m.matchedSymptom, 'falta de ar');
    assert.equal(m.isTopHighlight, true);
  });
});

test('Prompt 1: Semantic search handles "dor no peito", "dor de cabeça", "sangramento", and "febre"', () => {
  const { sandbox, runExpr } = extractScriptAndRun();

  sandbox.window.searchCommandPalette('dor no peito');
  let matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.trigger, ';sca', 'Dor Torácica / SCA must be #1 for "dor no peito"');
  assert.equal(matches[0].matchedSymptom, 'dor no peito');

  sandbox.window.searchCommandPalette('dor de cabeça');
  matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.trigger, ';cefaleia', 'Cefaleia Aguda must be #1 for "dor de cabeça"');
  assert.equal(matches[0].matchedSymptom, 'dor de cabeça');

  sandbox.window.searchCommandPalette('sangramento');
  matches = runExpr('cmdMatches');
  assert.ok([';hpp', ';hda'].includes(matches[0].item.trigger), 'HPP or HDA must be at the top for "sangramento"');
  assert.equal(matches[0].matchedSymptom, 'sangramento');

  sandbox.window.searchCommandPalette('febre');
  matches = runExpr('cmdMatches');
  assert.equal(matches[0].item.trigger, ';sepse', 'Sepse must be #1 for "febre"');
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

test('Preceptor V2.0 Audit: All 22 Clinical Skills cards upgraded in 05_Habilidades_Clinicas, snippets_hab.json, and index.html', () => {
  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const habItems = allData.filter((d: any) => d.mod_id === 'hab');
  assert.equal(habItems.length, 22, 'Must have all 22 Clinical Skills cards in index.html');

  const habJsonPath = path.resolve(process.cwd(), 'snippets/snippets_hab.json');
  const habJson = JSON.parse(fs.readFileSync(habJsonPath, 'utf8'));
  assert.equal(habJson.length, 22, 'snippets_hab.json must have 22 cards');

  for (const item of habItems) {
    assert.ok(item.trigger && item.trigger.startsWith(';hab-'), `Card ${item.id} must have a ;hab-* trigger`);
    assert.ok(item.anchor && item.anchor.length > 20, `Card ${item.id} must have a V2.0 anchor sequence`);
    assert.ok(item.pre_porta && item.pre_porta.length > 150, `Card ${item.id} pre_porta must include substantive Pré-Porta roteiro`);
    assert.ok(Array.isArray(item.checklist_sections) && item.checklist_sections.length >= 2, `Card ${item.id} must have structured checklist sections`);
    assert.ok(Array.isArray(item.pitfalls) && item.pitfalls.length >= 4, `Card ${item.id} must have Red Flags + Pitfalls populated`);

    // Verify corresponding markdown file on disk
    const mdFull = path.resolve(process.cwd(), item.path);
    const mdText = fs.readFileSync(mdFull, 'utf8');
    assert.ok(mdText.includes('## 🎯 1.'), `${item.path} must have section 1`);
    assert.ok(mdText.includes('## 🧠 2.'), `${item.path} must have section 2`);
    assert.ok(mdText.includes('## 🛠️ 3.'), `${item.path} must have section 3`);
    assert.ok(mdText.includes('## 🚨 4.'), `${item.path} must have section 4`);
    assert.ok(mdText.includes('## 📝 5.'), `${item.path} must have section 5`);
    assert.ok(mdText.includes('## ⚠️ 6.'), `${item.path} must have section 6`);
    assert.ok(mdText.includes('## ✅ 7.'), `${item.path} must have section 7`);
  }
});

test('Padrão Ouro PEP v2.0: All 88 PEP protocols (19 GO + 47 UPA + 9 Enfermaria + 13 Pediatria) have bipartite Conduta, Diretriz/Guia, and Outpatient Receitas', () => {
  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');
  assert.equal(pepItems.length, 88, 'Must have all 88 PEP protocols in index.html');

  const goItems = pepItems.filter((d: any) => d.mod_id === 'go');
  const upaItems = pepItems.filter((d: any) => d.mod_id === 'upa');
  const enfItems = pepItems.filter((d: any) => d.mod_id === 'enf');
  const pedItems = pepItems.filter((d: any) => d.mod_id === 'ped');

  assert.equal(goItems.length, 19, 'Must have 19 GO protocols');
  assert.equal(upaItems.length, 47, 'Must have 47 UPA protocols');
  assert.equal(enfItems.length, 9, 'Must have 9 Enfermaria protocols');
  assert.equal(pedItems.length, 13, 'Must have 13 Pediatria protocols');

  const withSplitAndGuia = pepItems.filter(
    (item: any) => item.has_split && item.conduta_body && item.conduta_body.length > 250 && item.has_guia && item.guia_body && item.guia_body.length > 400
  );
  assert.equal(withSplitAndGuia.length, 88, `Expected all 88 PEP protocols with bipartite Conduta and Diretriz/Guia, found ${withSplitAndGuia.length}`);

  // All 13 Pediatria protocols must have weight-based outpatient/discharge Receitas
  for (const item of pedItems) {
    assert.equal(item.has_receita, true, `Pediatria protocol ${item.id} (${item.trigger}) must have Receita Domiciliar / Alta`);
    assert.ok(item.receita_body && item.receita_body.length > 250, `Pediatria protocol ${item.id} must have complete receita_body`);
  }

  const totalReceitas = pepItems.filter((d: any) => d.has_receita && d.receita_body.length > 250).length;
  assert.ok(totalReceitas >= 55, `Expected at least 55 PEP protocols with complete Receita Domiciliar / Alta, found ${totalReceitas}`);
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

  // Verify PEP protocols with Diretrizes have multi-section structured content explaining "Por Que"
  for (const item of pepItems) {
    if (!item.has_guia || !item.guia_body) continue;
    assert.ok(
      item.guia_body.includes('### ') || item.guia_body.includes('## ') || item.guia_body.includes('**'),
      `Protocol ${item.id} must have structured sections in guia_body`
    );
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



test('Compositor Modular de Prescrição: Carrinho de Prescrição em 1 Clique (#tabCartBtn, #btnAddToCart, #drawerCartPanel)', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(html.includes('id="btnAddToCart"'), 'Must include #btnAddToCart button in drawer footer');
  assert.ok(html.includes('id="tabCartBtn"'), 'Must include #tabCartBtn tab in drawer tabs');
  assert.ok(html.includes('id="drawerCartPanel"'), 'Must include #drawerCartPanel dedicated UI panel');
  assert.ok(html.includes('function addCustomItemToCart'), 'Must define addCustomItemToCart function in JS');
  assert.ok(html.includes('function copyPrescriptionCart'), 'Must define copyPrescriptionCart function in JS');
});

test('Fase 1 (P0.1): Clinical Sanitizer strips internal instructions, secondary options, and Markdown headers while detecting pending gaps', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const { sandbox, elements } = extractScriptAndRun();

  const rawClinicalSample = [
    '###### EVOLUÇÃO DIÁRIA — ENFERMARIA ######',
    '# IDENTIFICAÇÃO:',
    'Paciente [Nome], [Idade] anos, PA: [110x70] mmHg, FC: [ ] bpm.',
    'Dor [ausente / leve / moderada].',
    '# CONDUTA E PRESCRIÇÃO:',
    '[NÃO PRESCREVER AINES EM CASO DE SUSPEITA DE DENGUE]',
    '1. [OPÇÃO 1 - 1ª ESCOLHA]: Amoxicilina 500mg VO de 8/8h por 7 dias.',
    '2. [OPÇÃO 2 - ALÉRGICOS A PENICILINA]: Azitromicina 500mg VO 1x/dia por 5 dias.',
    '3. [Se constipação intestinal ou dor]: Simeticona 40mg VO de 8/8h.',
    '4. [Opcional - se náuseas]: Ondansetrona 4mg VO de 8/8h.',
    '>> CUIDADOS GERAIS:',
    '- [x] Dieta oral livre',
    '- [ ] Hidratação venosa'
  ].join('\n');

  for (const fnSanitize of [enginePersonalizar.sanitizePepOutput, sandbox.window.sanitizePepOutput]) {
    const cleaned = fnSanitize(rawClinicalSample);
    assert.equal(cleaned.includes('######'), false, 'Must strip ###### banners');
    assert.equal(cleaned.includes('NÃO PRESCREVER'), false, 'Must strip [NÃO PRESCREVER...] safety alerts');
    assert.equal(cleaned.includes('OPÇÃO 1'), false, 'Must strip [OPÇÃO 1...] label');
    assert.equal(cleaned.includes('Azitromicina'), false, 'Must exclude secondary [OPÇÃO 2...] lines by default');
    assert.equal(cleaned.includes('[Se constipação'), false, 'Must strip [Se ...] conditional tags');
    assert.equal(cleaned.includes('[Opcional'), false, 'Must strip [Opcional...] tags');
    assert.equal(cleaned.includes('>>'), false, 'Must strip >> subheading prefix');
    assert.ok(cleaned.includes('1. Amoxicilina 500mg VO de 8/8h por 7 dias.'), 'Must preserve primary choice cleanly without orphaned colon');
    assert.ok(cleaned.includes('3. Simeticona 40mg VO de 8/8h.'), 'Must clean orphaned colon after conditional tag removal');
    assert.ok(cleaned.includes('Dor [ausente / leve / moderada].'), 'Must NOT blindly auto-select unresolved clinical choice brackets');
  }

  for (const fnGaps of [enginePersonalizar.detectPendingGaps, sandbox.window.detectPendingGaps]) {
    const gaps = fnGaps(rawClinicalSample);
    assert.equal(gaps.blankBrackets, 1, 'Must count 1 blank [ ] input (ignoring - [ ] checkbox)');
    assert.equal(gaps.namedPlaceholders, 2, 'Must count [Nome] and [Idade] named placeholders');
    assert.equal(gaps.unresolvedChoices, 1, 'Must count [ausente / leve / moderada] unresolved choice');
    assert.equal(gaps.total, 4, 'Total pending gaps must be 4');
  }

  // Verify Toast Pending Badge updates when copying a protocol with pending gaps
  await sandbox.window.copySnippet(0);
  assert.equal(elements.toastMsg.textContent, '✅ Snippet completo copiado com sucesso!');
  assert.ok(elements.toastPendingBadge.textContent.includes('lacuna'), 'Toast pending badge must warn about pending clinical gaps');
});

test('Fase 1 (P0.2 & P0.3): Cockpit Power Actions (1-4 + Reset) & Granular Section Extraction (Evolução, Conduta, Receita, Orientações)', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const { sandbox, elements } = extractScriptAndRun();

  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(html.includes('id="powerBtnCopyAll"'), 'Must include 1 Tudo button in #cockpitPowerActions');
  assert.ok(html.includes('id="powerBtnCopyConduta"'), 'Must include 2 Conduta button in #cockpitPowerActions');
  assert.ok(html.includes('id="powerBtnCopyReceita"'), 'Must include 3 Receita button in #cockpitPowerActions');
  assert.ok(html.includes('id="powerBtnCopyEvolucao"'), 'Must include 4 Evolução button in #cockpitPowerActions');
  assert.ok(html.includes('id="powerBtnResetPatient"'), 'Must include Reset Patient button in #cockpitPowerActions');
  assert.ok(html.includes('src="/src/engine/index.ts"'), 'Must link modularized src/engine/index.ts');

  const samplePep = [
    '# IDENTIFICAÇÃO:',
    'Paciente Maria, 28 anos.',
    '# SUBJETIVO:',
    'Refere melhora clínica.',
    '# OBJETIVO:',
    'PA: 110x70 mmHg | FC: 78 bpm.',
    '# AVALIAÇÃO:',
    'Puerpério fisiológico.',
    '# CONDUTA:',
    '- Dieta livre',
    '# PRESCRIÇÃO DE ALTA:',
    '1. Dipirona 500mg VO 6/6h se dor.',
    '# ORIENTAÇÕES DE ALTA E SINAIS DE ALARME:',
    '- Retornar se febre ou sangramento intenso.'
  ].join('\n');

  for (const fnExtract of [enginePersonalizar.extractBodiesFromCustomPep, sandbox.window.extractBodiesFromCustomPep]) {
    const bodies = fnExtract(samplePep);
    assert.ok(bodies.evolucao_body.includes('IDENTIFICAÇÃO') && bodies.evolucao_body.includes('AVALIAÇÃO'), 'evolucao_body must contain SOAP sections');
    assert.equal(bodies.evolucao_body.includes('PRESCRIÇÃO DE ALTA'), false, 'evolucao_body must exclude prescription');
    assert.ok(bodies.conduta_body.includes('Dieta livre'), 'conduta_body must contain Conduta section');
    assert.ok(bodies.receita_body.includes('Dipirona 500mg'), 'receita_body must contain Prescription section');
    assert.ok(bodies.orientacoes_body.includes('Retornar se febre'), 'orientacoes_body must contain Orientations section');
  }

  sandbox.window.openInspector(0);
  await sandbox.window.triggerPowerCopy(4);
  assert.equal(elements.toastMsg.textContent, '✅ Evolução copiada com sucesso!');
});

test('Fase 1 (P0.4 & Cart Parser): Compound Vitals inference (PA: [110x70]) and Multiline Prescription Cart Parser', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const engineWorkstation = await import('../src/engine/workstation.ts');
  const { sandbox } = extractScriptAndRun();

  for (const fnVital of [enginePersonalizar.inferVitalSignRole, sandbox.window.inferVitalSignRole]) {
    assert.equal(fnVital('110x70', '- Sinais Vitais: PA: '), 'pa-composta', 'Must detect compound PA [110x70]');
    assert.equal(fnVital('', 'PA: '), 'pa-composta', 'Must detect blank compound PA when not followed by /');
    assert.equal(fnVital('', 'PA: ', '/80'), 'pas', 'Must detect systolic PA when followed by /');
    assert.equal(fnVital('', 'PA: 120/'), 'pad', 'Must detect diastolic PA after /');
    assert.equal(fnVital('78', 'PA: 110x70 mmHg | FC: '), 'fc', 'Must detect FC after compound PA');
    assert.equal(fnVital('99', 'SpO2: '), 'spo2', 'Must detect SpO2');
    assert.equal(fnVital('36,5', 'Tax: '), 'tax', 'Must detect Tax');
  }

  const sampleReceita = [
    '# PRESCRIÇÃO DOMICILIAR:',
    '[NÃO PRESCREVER AINES]',
    '1. [OPÇÃO 1]: Amoxicilina 500mg (14 cápsulas)',
    '   Tomar 1 cápsula VO de 8/8h por 7 dias.',
    '2. [OPÇÃO 2 - ALÉRGICOS]: Azitromicina 500mg',
    '3. [Se dor ou febre]: Dipirona 500mg — tomar 1 cp de 6/6h.',
    '# ORIENTAÇÕES AO PACIENTE:',
    '1. Beber bastante líquido.',
    '2. Retornar se febre persistente.'
  ].join('\n');

  for (const fnParseCart of [engineWorkstation.parsePrescriptionItemsForCart, sandbox.window.parsePrescriptionItemsForCart]) {
    const items = fnParseCart(sampleReceita);
    assert.equal(items.length, 2, 'Must extract only the 2 active medications and ignore OPÇÃO 2 and ORIENTAÇÕES section');
    assert.ok(items[0].includes('Amoxicilina 500mg') && items[0].includes('Tomar 1 cápsula VO'), 'Must preserve multiline posology on item 1');
    assert.equal(items[0].includes('OPÇÃO 1'), false, 'Must strip [OPÇÃO 1] tag from cart item');
    assert.ok(items[1].includes('Dipirona 500mg'), 'Must extract item 3 without [Se dor ou febre] prefix');
  }
});

test('Fase 2 (P1.1 & P1.2): Unidirectional Free Edit Mode with Undo Stack, Inline Discard Confirmation, and Orientações / Meds-Only Copy', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const { sandbox, elements, runExpr } = extractScriptAndRun();

  // 1. Pure FreeEdit state & undo stack tests
  for (const mod of [enginePersonalizar, sandbox.window]) {
    let st = mod.createFreeEditState('Texto inicial compilado');
    assert.equal(st.active, true);
    assert.equal(st.dirty, false);
    assert.equal(st.undoStack.length, 1);

    st = mod.pushFreeEditSnapshot(st, 'Texto editado pelo plantonista v1');
    assert.equal(st.dirty, true);
    assert.equal(st.currentText, 'Texto editado pelo plantonista v1');
    assert.equal(st.undoStack.length, 2);

    st = mod.pushFreeEditSnapshot(st, 'Texto editado pelo plantonista v2');
    assert.equal(st.undoStack.length, 3);

    st = mod.undoFreeEditSnapshot(st);
    assert.equal(st.currentText, 'Texto editado pelo plantonista v1');
    assert.equal(st.dirty, true);

    st = mod.undoFreeEditSnapshot(st);
    assert.equal(st.currentText, 'Texto inicial compilado');
    assert.equal(st.dirty, false);
  }

  // 2. Unidirectional Source-of-Truth Lock & Inline Confirmation when returning to pills
  sandbox.window.openInspector(0);
  sandbox.window.enterFreeEditMode();
  assert.equal(elements.pepFreeEditWrap.classList.contains('is-open'), true, 'Free Edit wrapper must open');

  // Simulate manual edit in Free Edit Mode
  runExpr("pepFreeEditStates[0] = pushFreeEditSnapshot(pepFreeEditStates[0], '# IDENTIFICAÇÃO:\\nPaciente Editada Manualmente, 31 anos.\\n# PLANO / CONDUTA:\\nConduta ajustada manualmente.')");
  elements.pepFreeEditTextarea.value = '# IDENTIFICAÇÃO:\nPaciente Editada Manualmente, 31 anos.\n# PLANO / CONDUTA:\nConduta ajustada manualmente.';

  const resolvedDuringFreeEdit = runExpr('getResolvedProtocolBodies(0)');
  assert.ok(resolvedDuringFreeEdit.pep_body.includes('Paciente Editada Manualmente'), 'Free Edit text must be the single source of truth for pep_body');
  assert.ok(resolvedDuringFreeEdit.conduta_body.includes('Conduta ajustada manualmente'), 'Free Edit text must be the single source of truth for conduta_body');

  // Requesting exit while dirty must NOT discard immediately; it must open the inline confirmation bar
  sandbox.window.requestExitFreeEditMode();
  assert.equal(elements.pepFreeEditWrap.classList.contains('is-open'), true, 'Must stay in Free Edit Mode until user confirms discard');
  assert.equal(elements.pepFreeEditConfirmBar.classList.contains('is-open'), true, 'Must display inline discard confirmation bar');

  // Cancel discard keeps Free Edit Mode open
  sandbox.window.cancelExitFreeEditMode();
  assert.equal(elements.pepFreeEditConfirmBar.classList.contains('is-open'), false, 'Cancel must hide confirmation bar');
  assert.equal(elements.pepFreeEditWrap.classList.contains('is-open'), true, 'Cancel must preserve Free Edit Mode');

  // Confirm discard exits back to structured pills
  sandbox.window.confirmExitFreeEditMode();
  assert.equal(elements.pepFreeEditWrap.classList.contains('is-open'), false, 'Confirm discard must exit Free Edit Mode');

  // 3. Test Orientações (Shortcut 5) & Meds-Only Prescription extraction
  await sandbox.window.triggerPowerCopy(5);
  assert.equal(elements.toastMsg.textContent, '✅ Orientações ao paciente copiadas com sucesso!');

  await sandbox.window.copyReceitaMedsOnly(0);
  assert.equal(elements.toastMsg.textContent, '✅ Prescrição (só medicamentos) copiada com sucesso!');
  const resolved0 = runExpr('getResolvedProtocolBodies(0)');
  assert.ok(resolved0.receita_meds_body.includes('Sulfato Ferroso'), 'receita_meds_body must include medications');
  assert.equal(resolved0.receita_meds_body.includes('ORIENTAÇÕES DE ALTA'), false, 'receita_meds_body must exclude ORIENTAÇÕES DE ALTA');
  assert.ok(resolved0.orientacoes_body.includes('ORIENTAÇÕES DE ALTA'), 'orientacoes_body must contain ORIENTAÇÕES DE ALTA');
});

test('Fase 3 (P2): scripts/build_snippets.py uses portable BASE_PROJECT and safe anchored allData regex', () => {
  const pyPath = path.resolve(process.cwd(), 'scripts/build_snippets.py');
  const pyContent = fs.readFileSync(pyPath, 'utf8');
  assert.equal(pyContent.includes('/home/wagmoraes'), false, 'scripts/build_snippets.py must not hardcode /home/wagmoraes');
  assert.ok(pyContent.includes('os.path.dirname(os.path.dirname(os.path.abspath(__file__)))'), 'Must use portable repository root');
  assert.ok(pyContent.includes('// --- Estado Global ---'), 'Must anchor allData regex to // --- Estado Global ---');
});

test('Puerpério Evolução Diária: Header fields, optional [? ...] toggles, Evolução/Avaliação/Planejamento Reprodutivo updates', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const { sandbox, runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const go1 = allData.find((d: any) => String(d.path || '').includes('02_Puerperio_Evolucao_Diaria.md'));

  assert.ok(go1, 'Must find 02_Puerperio_Evolucao_Diaria.md');
  assert.ok(go1.pep_body.includes('ID: [Nome], [Idade] anos[? Leito :: , Leito [ ]].'), 'Header must have ID with optional Leito toggle');
  assert.ok(go1.pep_body.includes('TS Materna: [O+ / A+ / B+ / AB+ / O- / A- / B- / AB-][? TS RN :: | TS RN: [ ] (Coombs Direto: [*Negativo / Positivo])].'), 'Header must have TS Materna with optional TS RN toggle');
  assert.ok(go1.pep_body.includes('Comorbidades: [+ *Hígida / [ ]].'), 'Header must have Comorbidades with [+ *Hígida / [ ]]');
  assert.ok(go1.pep_body.includes('Alergias: [*Nega / [ ]].'), 'Header must have Alergias with [*Nega / [ ]]');
  assert.ok(go1.pep_body.includes('Sorologias: [Não reagentes (HIV, VDRL, HBsAg, Toxo) / [ ]].'), 'Header must include Sorologias');
  assert.equal(go1.pep_body.includes('Controles & Exames'), false, 'Subjetivo/Objetivo must omit Controles & Exames');
  assert.equal(go1.pep_body.includes('Negativas Mandatórias de Alarme:'), false, 'Subjetivo must omit Negativas Mandatórias de Alarme label');
  assert.ok(go1.pep_body.includes('- Nega cefaleia occipital/frontal, escotomas'), 'Subjetivo must keep alarm negatives sentence');
  assert.equal(go1.pep_body.includes('Apta para alta hospitalar'), false, 'Avaliação Diagnóstica must replace Apta para alta hospitalar');
  assert.ok(go1.pep_body.includes('Condições de alta hospitalar'), 'Avaliação Diagnóstica must include Condições de alta hospitalar');
  assert.ok(go1.pep_body.includes('Encaminhada à UBS para inserção de Implanon'), 'Planejamento Reprodutivo must include UBS Implanon option');
  assert.ok(go1.pep_body.includes('Encaminhada à UBS para inserção de DIU'), 'Planejamento Reprodutivo must include UBS DIU option');
  assert.ok(go1.pep_body.includes('Medroxiprogesterona 150 mg IM trimestral'), 'Planejamento Reprodutivo must include other contraceptive methods');
  assert.ok(go1.pep_body.includes('Laqueadura tubária realizada'), 'Planejamento Reprodutivo must include Laqueadura tubária');

  // Verify [? ...] optional blocks are stripped by default in sanitizePepOutput and ignored in detectPendingGaps
  for (const fnSanitize of [enginePersonalizar.sanitizePepOutput, sandbox.window.sanitizePepOutput]) {
    const cleaned = fnSanitize(go1.pep_body);
    assert.ok(cleaned.includes('ID: [Nome], [Idade] anos.'), 'Optional Leito must be omitted by default when sanitized');
    assert.equal(cleaned.includes('[? Leito'), false, 'Raw optional marker must never leak into sanitized output');
    assert.equal(cleaned.includes('TS RN:'), false, 'Optional TS RN must be omitted by default when sanitized');
    assert.equal(cleaned.includes('Coombs Direto:'), false, 'Optional Coombs Direto inside TS RN must be omitted by default');
  }

  for (const fnGaps of [enginePersonalizar.detectPendingGaps, sandbox.window.detectPendingGaps]) {
    const gapsOnlyOptional = fnGaps('ID: Maria, 28 anos[? Leito :: , Leito [ ]].\nTS Materna: O+[? TS RN :: | TS RN: [ ] (Coombs Direto: [Negativo / Positivo])].');
    assert.equal(gapsOnlyOptional.total, 0, 'Hidden optional [? ...] brackets must not count as pending gaps');
  }

  const tsChoicesEngine = enginePersonalizar.splitTopLevelChoices('? TS RN :: | TS RN: [ ] (Coombs Direto: [Negativo / Positivo])');
  assert.equal(tsChoicesEngine.length, 1, 'Optional [? ...] wrapper must not split on inner | character in engine');
  const tsChoicesDom = Array.from<string>(runExpr("splitTopLevelChoices('? TS RN :: | TS RN: [ ] (Coombs Direto: [Negativo / Positivo])')"));
  assert.equal(tsChoicesDom.length, 1, 'Optional [? ...] wrapper must not split on inner | character in index.html');
});

test('Padronização Global de Prontuário: zero rótulos "Negativas Mandatórias", fallback [ ] em Alergias/Comorbidades, Round de Puerpério e opcionais em Enfermaria/Pré-Natal', () => {
  const { runExpr } = extractScriptAndRun();
  const allData = Array.from<any>(runExpr('allData'));
  const pepItems = allData.filter((d: any) => d.mod_id !== 'hab');

  for (const item of pepItems) {
    assert.equal(
      /Negativas(?:\s+de\s+Gravidade)?\s+Mandatórias/i.test(item.pep_body),
      false,
      `Protocol ${item.id} must not expose artificial "Negativas Mandatórias" label`
    );

    const lines = String(item.pep_body).split('\n');
    for (const line of lines) {
      if (/^-\s*Alergias(?:\s+Medicamentosas|\s+&\s+Comorbidades)?:/i.test(line)) {
        assert.ok(line.includes('[ ]'), `Alergias line in ${item.id} must include free-text [ ] fallback: ${line}`);
      }
      if (/^-\s*Comorbidades(?:\s*\/\s*Fatores de Risco|\s+Ativas|\s*,\s*(?:HF|Drogas)\s*&\s*Alergias)?:/i.test(line)) {
        assert.ok(line.includes('[ ]'), `Comorbidades line in ${item.id} must include free-text [ ] fallback: ${line}`);
      }
    }
  }

  const go2 = pepItems.find((d: any) => String(d.path || '').includes('05_Puerperio_Round_Passagem_de_Caso.md'));
  assert.ok(go2 && go2.pep_body.includes('[? Leito :: Leito [ ], ]'), 'Round de Puerpério must have optional Leito');
  assert.ok(go2.pep_body.includes('[? TS RN ::'), 'Round de Puerpério must have optional TS RN');
  assert.ok(go2.pep_body.includes('Encaminhada à UBS para inserção de Implanon'), 'Round de Puerpério must include UBS Implanon');
  assert.ok(go2.pep_body.includes('Condições de alta hospitalar'), 'Round de Puerpério must use Condições de alta hospitalar');

  const go3 = pepItems.find((d: any) => String(d.path || '').includes('01_Pre_Natal_Primeira_Consulta.md'));
  assert.ok(go3 && go3.pep_body.includes('[? Profissão :: , Profissão: [ ]]'), 'Pré-Natal 1ª consulta must have optional Profissão');

  const enfWithLeito = pepItems.filter((d: any) => d.mod_id === 'enf' && d.pep_body.includes('[? Leito ::'));
  assert.ok(enfWithLeito.length >= 6, `Expected at least 6 Enfermaria protocols with optional Leito, found ${enfWithLeito.length}`);
});

test('Motor PEP v3.2: Multi-select [+ ...], Defaults [*...], junção gramatical, formato HMA/Exame Físico/Conduta e exportação limpa no build_snippets.py', async () => {
  const enginePersonalizar = await import('../src/engine/personalizar.ts');
  const { sandbox } = extractScriptAndRun();

  // 1. formatMultiChoices em TS e DOM
  for (const fmt of [enginePersonalizar.formatMultiChoices, sandbox.window.formatMultiChoices]) {
    assert.equal(fmt([]), '');
    assert.equal(fmt(['HAS']), 'HAS');
    assert.equal(fmt(['HAS', 'DM2']), 'HAS e DM2');
    assert.equal(fmt(['HAS', 'DM2', 'DPOC']), 'HAS, DM2 e DPOC');
  }

  // 2. parseChoiceGroupToken em TS e DOM
  for (const parseFn of [enginePersonalizar.parseChoiceGroupToken, sandbox.window.parseChoiceGroupToken]) {
    const multiDef = parseFn('+ *Nega / HAS / DM2 / [ ]');
    assert.equal(multiDef.isExplicitMulti, true);
    assert.equal(multiDef.hasDefault, true);
    assert.equal(multiDef.options[0].text, 'Nega');
    assert.equal(multiDef.options[0].isDefault, true);
    assert.equal(multiDef.options[1].text, 'HAS');
    assert.equal(multiDef.options[1].isDefault, false);

    const singleNoDef = parseFn('Masculino / Feminino');
    assert.equal(singleNoDef.isExplicitMulti, false);
    assert.equal(singleNoDef.hasDefault, false);
  }

  // 3. sanitizePepOutput resolve defaults [*...] e remove [? ...]
  const sampleTemplate = [
    '# IDENTIFICAÇÃO:',
    'ID: Maria, 42 anos, Sexo: Feminino[? Peso :: , Peso: [ ] kg].',
    'Comorbidades: [+ *Nega / HAS / DM2 / [ ]].',
    'Alergias: [*Nega alergias conhecidas / Dipirona / [ ]].',
    '# HMA:',
    '- Dor abdominal há 2 dias.',
    '# EXAME FÍSICO:',
    '- Estado geral: [*BEG, LOTE, corada / REG].',
    '# HIPÓTESES DIAGNÓSTICAS:',
    '- Gastroenterite aguda.',
    '# CONDUTA:',
    '- Sintomáticos e hidratação oral.'
  ].join('\n');

  for (const fnSanitize of [enginePersonalizar.sanitizePepOutput, sandbox.window.sanitizePepOutput]) {
    const cleaned = fnSanitize(sampleTemplate);
    assert.ok(cleaned.includes('Comorbidades: Nega.'), 'sanitizePepOutput must resolve [+ *Nega / ...] to Nega');
    assert.ok(cleaned.includes('Alergias: Nega alergias conhecidas.'), 'sanitizePepOutput must resolve [*...] default');
    assert.ok(cleaned.includes('Estado geral: BEG, LOTE, corada.'), 'sanitizePepOutput must resolve EXAME FÍSICO default');
    assert.equal(cleaned.includes('[? Peso'), false, 'Optional [? Peso] must be stripped by default');
  }

  // 4. detectPendingGaps não acusa lacuna para grupos com * default
  for (const fnGaps of [enginePersonalizar.detectPendingGaps, sandbox.window.detectPendingGaps]) {
    const report = fnGaps(sampleTemplate);
    assert.equal(report.total, 0, 'Groups with explicit * default must not count as pending gaps');
  }

  // 5. extractBodiesFromCustomPep reconhece HMA / EXAME FÍSICO / HIPÓTESES DIAGNÓSTICAS / CONDUTA
  const bodies = enginePersonalizar.extractBodiesFromCustomPep(sampleTemplate);
  assert.ok(bodies.evolucao_body.includes('HMA:'), 'evolucao_body must preserve HMA');
  assert.ok(bodies.evolucao_body.includes('HIPÓTESES DIAGNÓSTICAS:'), 'evolucao_body must preserve HIPÓTESES DIAGNÓSTICAS');
  assert.equal(bodies.evolucao_body.includes('CONDUTA:'), false, 'evolucao_body must stop before CONDUTA');
  assert.ok(bodies.conduta_body.includes('CONDUTA:'), 'conduta_body must start at CONDUTA');

  // 6. build_snippets.py possui clean_pep_for_static_export
  const pyPath = path.resolve(process.cwd(), 'scripts/build_snippets.py');
  const pyContent = fs.readFileSync(pyPath, 'utf-8');
  assert.ok(pyContent.includes('def clean_pep_for_static_export('), 'build_snippets.py must define clean_pep_for_static_export');
});

test('Fases 1 a 4: Central do 6º Ano & MedQuest Design System (Shell, Hoje 70/30, 7 Módulos Teóricos, Gasometria 5 Passos, LR/Bayes, Logbook e Prompts IA)', async () => {
  const centralEngine = await import('../src/engine/central6ano.ts');
  const { FORMACAO_TEORICA_MODULOS } = await import('../src/data/formacao_teorica_data.ts');
  const { sandbox, runExpr } = extractScriptAndRun();

  // 1. MedQuest Shell & Navegação das 7 Seções + Light/Dark + Modo Zen + Sidebar Colapsável
  assert.equal(typeof sandbox.window.switchAppSection, 'function', 'switchAppSection must be exposed');
  assert.equal(typeof sandbox.window.toggleClinicalTheme, 'function', 'toggleClinicalTheme must be exposed');
  assert.equal(typeof sandbox.window.toggleZenMode, 'function', 'toggleZenMode must be exposed');
  assert.equal(typeof sandbox.window.toggleSidebarCollapse, 'function', 'toggleSidebarCollapse must be exposed');

  assert.equal(sandbox.window.switchAppSection('hoje'), 'hoje');
  assert.equal(sandbox.window.switchAppSection('teoria'), 'teoria');
  assert.equal(sandbox.window.switchAppSection('ferramentas'), 'ferramentas');
  assert.equal(sandbox.window.switchAppSection('logbook'), 'logbook');
  assert.equal(sandbox.window.switchAppSection('config'), 'config');
  assert.equal(sandbox.window.switchAppSection('preporta'), 'preporta');
  assert.equal(sandbox.window.switchAppSection('pep'), 'pep');

  assert.equal(sandbox.window.toggleClinicalTheme('light'), 'light');
  assert.equal(sandbox.window.toggleClinicalTheme('dark'), 'dark');
  assert.equal(sandbox.window.toggleZenMode(true), true);
  assert.equal(sandbox.window.toggleZenMode(false), false);
  assert.equal(sandbox.window.toggleSidebarCollapse(true), true);
  assert.equal(sandbox.window.toggleSidebarCollapse(false), false);

  // 2. Motor Dinâmico "Hoje (6º Ano)" + Rastreador 70/30 + Streak + Backup JSON
  sandbox.window.updateHojeSelect('rodizioId', 'cirurgia');
  sandbox.window.updateHojeSelect('marchaId', '3_normal');
  sandbox.window.updateHojeSelect('arquetipoId', 'dia_cheio');
  sandbox.window.updateHojeSelect('diaSemana', 'seg');
  sandbox.window.addWeeklyQuestions('ancora', 15);
  sandbox.window.addWeeklyQuestions('trilha', 10);
  const stAfterQ = sandbox.window.getCentral6AnoState();
  assert.equal(stAfterQ.rodizioId, 'cirurgia');
  assert.equal(stAfterQ.questoesAncoraSem, 15);
  assert.equal(stAfterQ.questoesTrilhaSem, 10);

  const exportedJson = sandbox.window.exportCentral6AnoBackupJson();
  assert.ok(exportedJson.includes('"rodizioId": "cirurgia"'), 'Exported JSON must serialize Central do 6º Ano state');
  assert.equal(sandbox.window.importCentral6AnoBackupJson(exportedJson), true, 'Import JSON must restore valid backup');

  // 3. Formação Teórica (7 Módulos Completos) & Link Bidirecional com Pré-Porta 30s
  assert.equal(FORMACAO_TEORICA_MODULOS.length, 7, 'Must have all 7 theoretical modules');
  for (const mod of FORMACAO_TEORICA_MODULOS) {
    assert.ok(mod.markdown.length > 2500, `Module ${mod.id} must contain complete theoretical content`);
    assert.ok(Array.isArray(mod.relatedHabIds) && mod.relatedHabIds.length >= 1, `Module ${mod.id} must link to related Pré-Porta 30s cards`);
  }
  sandbox.window.selectTeoriaModule('mod-05');
  sandbox.window.setTeoriaModStatus('dominado');
  assert.equal(sandbox.window.getCentral6AnoState().teoriaStatusById['mod-05'], 'dominado');

  // 4. Calculadora de Gasometria em 5 Passos (Winter + AG Corrigido + Delta-Delta)
  const gasoSepse = centralEngine.calcGasometria5Passos({
    ph: 7.22,
    pco2: 26,
    hco3: 10,
    na: 140,
    cl: 100,
    albumina: 2.0,
    lactato: 4.8
  });
  assert.equal(gasoSepse.agBruto, 30, 'Raw AG must be 140 - (100 + 10) = 30');
  assert.equal(gasoSepse.agCorrigido, 35, 'Albumin-corrected AG for Alb 2.0 must be 30 + 2.5*(4-2) = 35');
  assert.ok(gasoSepse.passo2Primario.includes('Acidose Metabólica'), 'Primary disorder must be metabolic acidosis');
  assert.ok(gasoSepse.passo3Compensacao.includes('21 a 25 mmHg'), 'Winter formula for HCO3=10 must be 23 ± 2 mmHg');
  assert.ok(gasoSepse.passo5DeltaDelta.includes('1.64'), 'Delta-Delta for AGcorr=35 (ΔAG=23) and HCO3=10 (ΔHCO3=14) must be ~1.64');

  const domGaso = sandbox.window.loadGasoPreset('sepse');
  assert.equal(domGaso.agCorrigido, 27, 'Sepse preset (Na 138, Cl 102, HCO3 14, Alb 2.0) must yield AGcorr = 27');
  assert.equal(domGaso.deltaRatio, 1.5, 'Sepse preset (ΔAG=15, ΔHCO3=10) must yield Delta-Delta = 1.5');

  // 5. Simulador Bayesiano (Probabilidade Pré-Teste × LR+ / LR-)
  const bayesPos = centralEngine.calcPostTestProbability(40, 5.2);
  const bayesNeg = centralEngine.calcPostTestProbability(40, 0.25);
  assert.ok(bayesPos.postPct > 75 && bayesPos.postPct < 79, `Post-test positive probability for 40% with LR+ 5.2 should be ~77.6%, got ${bayesPos.postPct}`);
  assert.ok(bayesNeg.postPct > 13 && bayesNeg.postPct < 16, `Post-test negative probability for 40% with LR- 0.25 should be ~14.3%, got ${bayesNeg.postPct}`);

  // 6. Central de Prompts Contextuais (1 Clique) & Command Palette Unificado
  for (const kind of ['paciente', 'oratoria', 'raciocinio', 'exames', 'osce'] as const) {
    const prompt = sandbox.window.copyContextualPrompt(kind);
    assert.ok(prompt.length > 180, `Contextual prompt "${kind}" must be generated with rich clinical instructions`);
    assert.ok(prompt.includes('Cirurgia Geral'), `Contextual prompt "${kind}" must inject the active rotation context`);
  }

  sandbox.window.searchCommandPalette('winter');
  const winterMatches = runExpr('cmdMatches');
  assert.ok(
    Array.isArray(winterMatches) && winterMatches.some((m: any) => m.item && String(m.item.title).includes('Gasometria')),
    'Command Palette (Ctrl+K) must find Gasometria calculator & theoretical module when searching "winter"'
  );
});

test('Aba Hoje (6º Ano): Blindagem Diária de Checklists, Streak Anti-Duplicação, FDS Férias, Marcha 4 Sprint, Deep-Links, Pontos Cegos & Sincronização Real', async () => {
  const centralEngine = await import('../src/engine/central6ano.ts');
  const { sandbox, elements } = extractScriptAndRun();

  // 1. Motor TypeScript: FDS das Férias não força 4h úteis + Marcha 4 Sprint R1 + Calendário Real
  const fdsFeriasSteps = centralEngine.buildDailyTimeline({
    rodizioId: 'ferias',
    feriasSemana: 'sem1',
    marchaId: '3_normal',
    arquetipoId: 'ferias_4h',
    diaSemana: 'sab',
    microHabitoSemanal: 'Anamnese',
    questoesAncoraSem: 0,
    questoesTrilhaSem: 0,
    streakDias: 0,
    semanasConcluidas: 0,
    ultimoDiaConcluidoIso: '',
    checkedTimelineIds: {},
    curriculoDoneIds: {},
    ritualDomingoDoneIds: {}
  });
  assert.ok(fdsFeriasSteps.some((s) => s.categoria.includes('FDS LIVRE')), 'Saturday in vacation must schedule free weekend recovery instead of 4h weekday block');

  const sprintSteps = centralEngine.buildDailyTimeline({
    rodizioId: 'sprint_r1',
    feriasSemana: 'sem1',
    marchaId: '4_sprint',
    arquetipoId: 'fds',
    diaSemana: 'sab',
    microHabitoSemanal: 'OSCE',
    questoesAncoraSem: 0,
    questoesTrilhaSem: 0,
    streakDias: 0,
    semanasConcluidas: 0,
    ultimoDiaConcluidoIso: '',
    checkedTimelineIds: {},
    curriculoDoneIds: {},
    ritualDomingoDoneIds: {}
  });
  assert.ok(sprintSteps[0].titulo.includes('Prova Antiga na Íntegra'), 'Saturday in Sprint R1 (Marcha 4) must schedule full timed exam');

  const calFerias = centralEngine.resolveCalendarContextForDate(new Date(2026, 11, 9, 10, 0, 0)); // 09/12/2026 (Quarta)
  assert.equal(calFerias.rodizioId, 'ferias');
  assert.equal(calFerias.feriasSemana, 'sem2');
  assert.equal(calFerias.diaSemana, 'qua');

  const calCir = centralEngine.resolveCalendarContextForDate(new Date(2027, 1, 1, 10, 0, 0)); // 01/02/2027 (Segunda)
  assert.equal(calCir.rodizioId, 'cirurgia');
  assert.equal(calCir.diaSemana, 'seg');

  // 2. Streak anti-duplicação no mesmo dia & Reset semanal sem apagar checklist diário
  sandbox.window.toggleHojeTimelineStep('dc-hospital-anki');
  sandbox.window.toggleSundayRitualItem('rit-escala');
  sandbox.window.addWeeklyQuestions('ancora', 25);
  sandbox.window.addWeeklyQuestions('ancora', -5);
  assert.equal(sandbox.window.getCentral6AnoState().questoesAncoraSem, 20, 'Fine adjustment -5 must decrement without resetting');

  const st1 = sandbox.window.completeHojeDayAndIncrementStreak();
  const st2 = sandbox.window.completeHojeDayAndIncrementStreak();
  assert.equal(st1, st2, 'Calling completeHojeDayAndIncrementStreak twice on the same day must not double-increment streak');

  sandbox.window.resetWeeklyQuestions();
  const stateAfterReset = sandbox.window.getCentral6AnoState();
  assert.equal(stateAfterReset.questoesAncoraSem, 0, 'Weekly reset must zero weekly question counters');
  assert.equal(Boolean(stateAfterReset.checkedTimelineIds['dc-hospital-anki']), true, 'Weekly question reset must preserve daily timeline checkboxes');
  assert.equal(Boolean(stateAfterReset.ritualDomingoDoneIds['rit-escala']), true, 'Weekly question reset must preserve Sunday ritual checkboxes');

  // 3. Toggle Anki hoje + Blind spots preview + Deep-link direto para módulo teórico + Tela inicial configurável
  assert.equal(sandbox.window.toggleAnkiDoneToday(), true, 'toggleAnkiDoneToday must toggle Anki completion state for today');
  sandbox.window.addLogbookEntryUI({
    tipo: 'ponto_cego',
    papel: 'Feedback de Preceptor/Residente',
    titulo: 'Esqueci de perguntar DUM em dor em FID',
    aprendizado: 'Sempre checar atraso menstrual antes de fechar diagnóstico de apendicite.'
  });
  const blindHtml = elements['hojeBlindSpotsPreview'] ? elements['hojeBlindSpotsPreview'].innerHTML : '';
  assert.ok(blindHtml.includes('Esqueci de perguntar DUM'), 'Hoje Blind Spots tile must display latest blind spots from Logbook');

  sandbox.window.openTimelineShortcut('teoria', 'mod-03', '');
  assert.equal(sandbox.window.getCentral6AnoState().activeTeoriaModId, 'mod-03', 'Timeline shortcut must jump directly to exact theory module');
  assert.equal(sandbox.window.setDefaultStartSection('hoje'), 'hoje', 'Config must persist preferred start section');
  assert.equal(sandbox.window.setDefaultStartSection('pep'), 'pep');
});

test('Auditoria Completa: Backup v2 (Carrinho + Hab Checklists), Logbook delete, Teoria LaTeX/Tabelas & Gasometria Edge-Cases', async () => {
  const centralEngine = await import('../src/engine/central6ano.ts');
  const { sandbox, runExpr, lsStore } = extractScriptAndRun();

  // 1. Mudar para pré-porta e voltar para PEP mesmo sem DOM real completo (previne regressão activeMod)
  assert.equal(sandbox.window.switchAppSection('preporta'), 'preporta');
  assert.equal(runExpr('activeModule'), 'hab');
  assert.equal(sandbox.window.switchAppSection('pep'), 'pep');
  assert.equal(runExpr('activeModule'), 'all');

  // 2. Gasometria com lactato=0 e HCO3 >= 24 + AG elevado (nunca deve gerar 99 nem duplicar diagnóstico)
  const gasoNormLac = centralEngine.calcGasometria5Passos({
    ph: 7.42,
    pco2: 38,
    hco3: 25,
    na: 142,
    cl: 98,
    albumina: 4.0,
    lactato: 0
  });
  assert.equal(gasoNormLac.deltaRatio, null, 'deltaRatio must be null when dHco3 <= 0');
  assert.ok(!gasoNormLac.passo5DeltaDelta.includes('99'), 'Must not leak artificial 99');
  assert.ok(!gasoNormLac.diagnosticoFinal.includes('Hiperlactatemia'), 'Lactato = 0 must not fall back to default 1.0 or Hiperlactatemia');

  // 3. Logbook: adicionar e deletar entrada + exportação com sanitização Markdown
  sandbox.window.addLogbookEntryUI({
    tipo: 'ponto_cego',
    papel: 'Autoavaliação',
    titulo: 'Teste `código` e\nquebra',
    aprendizado: 'Nota `inline`\nsegunda linha'
  });
  const afterAdd = sandbox.window.getCentral6AnoState().logbookEntries;
  assert.ok(afterAdd.length >= 1);
  const addedId = afterAdd[0].id;
  const mdOut = sandbox.window.exportLogbookMarkdown();
  assert.ok(mdOut.includes("Teste 'código' e quebra"), 'Exported Markdown must sanitize backticks/newlines');
  sandbox.window.deleteLogbookEntryUI(addedId);
  assert.equal(sandbox.window.getCentral6AnoState().logbookEntries.some((e: any) => e.id === addedId), false);

  // 4. Backup v2 completo + validação estrita contra JSON inválido
  lsStore['hab_checklist_v1:card-1'] = JSON.stringify({ sec1_0: true });
  const backupStr = sandbox.window.exportCentral6AnoBackupJson();
  const backupObj = JSON.parse(backupStr);
  assert.equal(backupObj.version, 'central-6ano-v2');
  assert.ok(backupObj.habChecklists && backupObj.habChecklists['hab_checklist_v1:card-1']?.sec1_0 === true);
  assert.equal(sandbox.window.importCentral6AnoBackupJson('{invalid json'), false);
  assert.equal(sandbox.window.importCentral6AnoBackupJson('{}'), false);
  assert.equal(sandbox.window.importCentral6AnoBackupJson(backupStr), true);
});






