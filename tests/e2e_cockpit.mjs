import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
function loadPlaywrightCore() {
  try {
    return require('playwright-core');
  } catch {
    const npxDir = path.join(os.homedir(), '.npm', '_npx');
    if (fs.existsSync(npxDir)) {
      for (const entry of fs.readdirSync(npxDir)) {
        const candidate = path.join(npxDir, entry, 'node_modules', 'playwright-core');
        if (fs.existsSync(candidate)) return require(candidate);
      }
    }
    throw new Error('playwright-core não encontrado. Rode `npx --yes -p playwright-core node tests/e2e_cockpit.mjs`.');
  }
}
const { chromium } = loadPlaywrightCore();

const ROOT = process.cwd();
const PORT = 4173;
const BASE_URL = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;
const SCREENSHOT_DIR = '/tmp/cockpit_cmp';

function findChromiumExecutable() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const cacheDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir).sort().reverse();
    for (const entry of entries) {
      const candidates = [
        path.join(cacheDir, entry, 'chrome-linux', 'chrome'),
        path.join(cacheDir, entry, 'chrome-linux64', 'chrome'),
        path.join(cacheDir, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
        path.join(cacheDir, entry, 'chrome-linux', 'headless_shell'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return undefined;
}

async function waitForServer(url, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Wait for preview server
    }
    await delay(250);
  }
  throw new Error(`Servidor preview não respondeu em ${url}`);
}

async function assertNoBrowserDefaultButtons(page, sectionName) {
  const offenders = await page.evaluate(() => {
    const bad = [];
    for (const btn of document.querySelectorAll('button')) {
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const st = getComputedStyle(btn);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      const bg = st.backgroundColor;
      if (
        bg === 'rgb(255, 255, 255)' ||
        bg === 'rgb(239, 239, 239)' ||
        bg === 'rgb(240, 240, 240)'
      ) {
        bad.push(`${btn.id || btn.className || 'button'}: ${bg} ("${btn.textContent?.trim().slice(0, 30)}")`);
      }
    }
    return bad;
  });
  assert.deepEqual(
    offenders,
    [],
    `Seção "${sectionName}" exibiu botões sem tema (branco/cinza default) no dark mode: ${offenders.join(' | ')}`
  );
}

async function assertVisibleInputsLabeled(page, sectionName) {
  const unlabeled = await page.evaluate(() => {
    const problems = [];
    for (const el of document.querySelectorAll('#appSectionWorkspace input, #appSectionWorkspace select')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const id = el.id;
      const hasFor = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
      const hasWrapLabel = Boolean(el.closest('label'));
      const hasAria = Boolean(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
      if (!hasFor && !hasWrapLabel && !hasAria) {
        problems.push(`${el.tagName}#${id || '(sem id)'}`);
      }
    }
    return problems;
  });
  assert.deepEqual(
    unlabeled,
    [],
    `Seção "${sectionName}" tem inputs/selects sem <label> ou aria-label: ${unlabeled.join(', ')}`
  );
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  let server = null;
  if (!process.env.E2E_URL) {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    await waitForServer(BASE_URL);
  }

  try {
    const executablePath = findChromiumExecutable();
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // =========================================================================
    // DESKTOP (1440x900)
    // =========================================================================
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#wsMainSectionNav [data-section="pep"]', { timeout: 5000 }).catch(() => {
      throw new Error(`Sidebar não hidratou. Erros: ${JSON.stringify(errors)}`);
    });

    // 1. Google Fonts + Anti-FOUC loaded
    const fontsOk = await page.evaluate(() => {
      const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href') || '');
      return hrefs.some((h) => h.includes('Inter') && h.includes('JetBrains+Mono') && h.includes('Plus+Jakarta+Sans'));
    });
    assert.equal(fontsOk, true, 'Google Fonts (Inter, JetBrains Mono, Plus Jakarta Sans) devem estar carregadas no <head>');

    // 2. Sidebar 2 groups + no Habilidades filter in PEP specialty list
    const sidebarGroups = await page.locator('#wsMainSectionNav .ws-nav-group').count();
    assert.equal(sidebarGroups, 2, 'Sidebar deve exibir os 2 blocos principais');
    const sidebarText = (await page.locator('#wsSidebar').textContent()) || '';
    assert.ok(sidebarText.includes('Protocolos PEP') && sidebarText.includes('Hoje (6º Ano)'), 'Sidebar deve conter seções PEP e Hoje');
    assert.equal(await page.locator('#moduleTabs [data-mod="hab"]').count(), 0, 'Filtro PEP não deve duplicar Habilidades (22)');

    // 3. Initial 88 PEPs in list + 3-column non-overlapping desktop layout + topbar hidden
    const cardCount = await page.locator('#cardsGrid .card').count();
    assert.equal(cardCount, 88, `Esperado 88 cards PEP iniciais, encontrado ${cardCount}`);

    const layoutCheck = await page.evaluate(() => {
      const sb = document.getElementById('wsSidebar')?.getBoundingClientRect();
      const lp = document.getElementById('wsListPane')?.getBoundingClientRect();
      const dr = document.getElementById('drawerOverlay')?.getBoundingClientRect();
      const sbStatus = document.querySelector('.ws-status-block')?.getBoundingClientRect();
      const drTabs = document.querySelector('.drawer-tabs')?.getBoundingClientRect();
      const topbarDisplay = getComputedStyle(document.querySelector('.topbar')).display;
      return { sb, lp, dr, sbStatus, drTabs, topbarDisplay };
    });
    assert.equal(layoutCheck.topbarDisplay, 'none', 'Topbar mobile deve ficar oculta no Desktop >= 1024px');
    assert.ok(layoutCheck.sb && layoutCheck.lp && layoutCheck.dr, 'As 3 colunas devem existir no Desktop');
    assert.ok(layoutCheck.sb.x >= 0 && (!layoutCheck.sbStatus || layoutCheck.sbStatus.x >= 0), 'Sidebar sem clipping');
    assert.ok(layoutCheck.drTabs && layoutCheck.drTabs.height >= 24, 'drawer-tabs deve estar visível');
    assert.ok(layoutCheck.sb.width > 180 && layoutCheck.lp.width > 280 && layoutCheck.dr.width > 400, 'Larguras válidas das 3 colunas');
    assert.ok(layoutCheck.sb.x < layoutCheck.lp.x && layoutCheck.lp.x < layoutCheck.dr.x, '3 colunas lado a lado');

    await assertNoBrowserDefaultButtons(page, 'pep');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_pep.png` });

    // 4. Filtro Pediatria, Peso Pediátrico, Carrinho e Novo Paciente
    await page.locator('#moduleTabs [data-mod="ped"]').click();
    assert.equal(await page.locator('#cardsGrid .card').count(), 13, 'Filtro Pediatria deve exibir 13 PEPs');

    await page.locator('#wsSearchInput').fill(';ped-otite');
    await delay(120);
    await page.locator('#cardsGrid .card').first().click();
    const drawerHtmlTreino = (await page.locator('#drawerInteractivePanel').innerHTML()) || '';
    assert.ok(drawerHtmlTreino.includes('pepRegisterLogbookBtn') || drawerHtmlTreino.includes('Formação Teórica'));

    const pesoInput = page.locator('#drawerInteractivePanel input.pep-inline-input').first();
    await pesoInput.fill('15');
    await pesoInput.dispatchEvent('change');

    await page.locator('#pepAddCartBtn').click();
    const cartCountText = (await page.locator('#cartItemCountBadge').textContent())?.trim();
    assert.ok(Number(cartCountText) >= 1, `Carrinho deve registrar >= 1 item (badge=${cartCountText})`);

    await page.locator('#wsClearSearchBtn').click();
    await page.locator('#btnNovoPaciente').click();
    assert.equal((await page.locator('#cartItemCountBadge').textContent())?.trim(), '0', 'Novo Paciente deve zerar o carrinho');

    // 4b. Modelo Padrão, Chip Opcional TS RN e Cálculo Automático USG 1º Tri
    await page.locator('#moduleTabs [data-mod="go"]').click();
    await page.locator('#wsSearchInput').fill(';puerp-evo');
    await delay(120);
    await page.locator('#cardsGrid .card').first().click();
    await page.locator('#tabStandardBtn').click();
    const stdText = (await page.locator('#drawerStandardPanel').textContent()) || '';
    assert.ok(stdText.includes('Modelo Padrão'), 'Aba Modelo Padrão deve exibir o texto padrão não personalizado');
    assert.equal(stdText.includes('TS RN:'), false, 'Modelo padrão deve omitir campos opcionais [? TS RN :: ...]');

    await page.locator('#tabPepBtn').click();
    assert.ok((await page.locator('#drawerInteractivePanel .pep-opt-inline.is-off').count()) >= 1, 'TS RN deve iniciar como chip opcional desligado (.is-off)');

    await page.locator('#wsSearchInput').fill(';pn-1cons');
    await delay(120);
    await page.locator('#cardsGrid .card').first().click();
    const usgCcnInp = page.locator('#drawerInteractivePanel input.pill-sub-input[data-usg-role="usg-ccn"]').first();
    const usgDateInp = page.locator('#drawerInteractivePanel input.pill-sub-input[data-usg-role="usg-date"]').first();
    await usgCcnInp.fill('45');
    const today = new Date();
    const brToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    await usgDateInp.fill(brToday);
    const igDefW = await page.locator('#drawerInteractivePanel input[data-obstetric-role="ig-def-w"]').first().inputValue();
    assert.equal(igDefW, '11', `CCN 45mm na data de hoje deve calcular IG Definitiva = 11s (obtido: ${igDefW})`);

    await page.locator('#pepToggleFreeEditBtn').click();
    await assertVisibleInputsLabeled(page, 'pep-free-edit');
    const freeBox = await page.locator('#pepFreeEditTextarea').boundingBox();
    assert.ok(freeBox && freeBox.height > 100, 'Edição Livre deve exibir #pepFreeEditTextarea visível');
    assert.ok(((await page.locator('#pepFreeEditTextarea').inputValue()) || '').includes('IDENTIFICAÇÃO:'), 'Edição Livre deve conter texto do PEP');
    await page.locator('#pepToggleFreeEditBtn').click();

    await page.locator('#tabGuiaBtn').click();
    assert.ok((await page.locator('#drawerGuiaPanel .guia-table, #drawerGuiaPanel .guia-list').count()) >= 1, 'Diretrizes deve renderizar listas/tabelas HTML estruturadas');
    await page.locator('#tabPepBtn').click();

    await page.locator('#wsClearSearchBtn').click();

    // 5. Command Palette (Ctrl+K) + Busca Semântica por Sintomas + Quick Copy + Power Actions 1-5
    await page.locator('#moduleTabs [data-mod="all"]').click();
    await page.locator('#wsSearchInput').fill('dor no peito');
    await delay(120);
    assert.ok((await page.locator('#cardsGrid .card-symptom-match-badge').count()) >= 1, 'Busca por sintoma deve exibir badge 🎯 de sintoma correspondente');
    assert.ok((await page.locator('#cardsGrid .card [data-quick-copy="1"]').count()) >= 1, 'Cards da lista devem ter botão rápido Copiar Tudo');
    assert.ok((await page.locator('#cockpitPowerActions [data-power-action]').count()) === 5, 'Cabeçalho do Cockpit deve ter os 5 botões de Power Action (1-5)');
    await page.locator('#wsClearSearchBtn').click();

    await page.keyboard.press('Control+k');
    assert.ok((await page.locator('#cmdQuickNavChips [data-cmd-nav]').count()) >= 6, 'Ctrl+K deve exibir chips de navegação rápida');
    await page.locator('#cmdSearchInput').fill('síndrome coronariana');
    assert.ok((await page.locator('#cmdResults [data-cmd-type="pep"]').count()) >= 1, 'Ctrl+K deve encontrar PEP por busca clínica');
    await page.locator('#cmdCloseBtn').click();

    // 6. Pré-Porta 30s
    await page.locator('#wsMainSectionNav [data-section="preporta"]').click();
    await delay(120);
    assert.equal(await page.locator('.hab-card-nav-btn').count(), 22, 'Pré-Porta deve listar os 22 cartões na barra lateral');
    assert.ok((await page.locator('.hab-pre-step').count()) >= 1, 'Pré-Porta deve renderizar passos estruturados (.hab-pre-step)');
    assert.ok((await page.locator('.hab-sec5-box #habCopySec5Btn').count()) === 1, 'Pré-Porta deve exibir Seção 5 com botão Copiar Registro');
    const stepsText = (await page.locator('.hab-steps-list').textContent()) || '';
    assert.equal(/>>>\s*COMO REGISTRAR/i.test(stepsText), false, 'Roteiro Pré-Porta não deve conter >>> COMO REGISTRAR');
    await assertNoBrowserDefaultButtons(page, 'preporta');
    await assertVisibleInputsLabeled(page, 'preporta');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_preporta.png` });

    // Aba Checklist
    await page.locator('[data-hab-tab="checklist"]').click();
    await delay(80);
    const checkTexts = await page.locator('.hab-check-text').allTextContents();
    assert.ok(checkTexts.length >= 5, 'Checklist Pré-Porta deve ter itens');
    assert.equal(
      checkTexts.some((t) => /^\[CR[IÍ]TICO\]/i.test(t.trim())),
      false,
      'Texto do checklist não deve duplicar prefixo [CRÍTICO]'
    );
    const firstCheck = page.locator('[data-hab-check]').first();
    await firstCheck.check();
    await delay(50);
    assert.ok(((await page.locator('.hab-progress-count').textContent()) || '').startsWith('1/'), 'Contador do checklist deve atualizar ao marcar item');

    // Aba Armadilhas
    await page.locator('[data-hab-tab="armadilhas"]').click();
    await delay(80);
    const pfTitles = await page.locator('.hab-pitfall-title').allTextContents();
    assert.ok(pfTitles.length >= 3, 'Armadilhas deve exibir cards');
    assert.equal(pfTitles.length, new Set(pfTitles.map((t) => t.trim().toLowerCase())).size, 'Armadilhas não deve repetir títulos');
    const pfVisibleText = (await page.locator('.hab-pitfalls-list').textContent()) || '';
    assert.equal(pfVisibleText.includes('`'), false, 'Armadilhas não deve conter crases Markdown cruas');

    // Aba Técnica Profunda
    await page.locator('[data-hab-tab="tecnica"]').click();
    await delay(80);
    assert.ok((await page.locator('.hab-flow-diagram .hab-flow-node').count()) >= 3, 'Técnica Profunda deve renderizar fluxograma visual');
    const techText = (await page.locator('.hab-panel').textContent()) || '';
    assert.equal(techText.includes('```mermaid'), false, 'Técnica Profunda não deve exibir bloco ```mermaid cru');
    await assertNoBrowserDefaultButtons(page, 'preporta-tecnica');

    // 7. Ferramentas & Calc (sub-abas + labels + screenshot)
    await page.locator('#wsMainSectionNav [data-section="ferramentas"]').click();
    await delay(100);
    await assertNoBrowserDefaultButtons(page, 'ferramentas-gaso');
    await assertVisibleInputsLabeled(page, 'ferramentas-gaso');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_ferramentas.png` });

    await page.locator('[data-ftab="calc"]').click();
    await assertVisibleInputsLabeled(page, 'ferramentas-calc');
    await page.locator('[data-ftab="exames"]').click();
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('ECG em 10 Passos'));
    await page.locator('[data-ftab="raciocinio"]').click();
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('Raciocínio Clínico'));
    await page.locator('[data-ftab="oratoria"]').click();
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('Modo Palco'));

    // 8. Formação Teórica (headings reais, zero Markdown cru, zero hab-X cru, screenshot)
    await page.locator('#wsMainSectionNav [data-section="teoria"]').click();
    await delay(120);
    const teoriaChecks = await page.evaluate(() => {
      const prose = document.querySelector('#teoriaReaderArticle.mq-prose-clinical');
      const hCount = prose ? prose.querySelectorAll('h1, h2').length : 0;
      const text = prose ? prose.innerText : '';
      const hasRawMd = /(^|\n)\s*(#{1,3}\s+|---\s*$)/m.test(text);
      const chipTexts = [...document.querySelectorAll('[data-open-hab]')].map((el) => el.textContent?.trim() || '');
      const hasRawHabId = chipTexts.some((t) => /\bhab-\d+\b/i.test(t));
      return { hCount, hasRawMd, chipTexts, hasRawHabId };
    });
    assert.ok(teoriaChecks.hCount >= 2, `Teoria deve renderizar headings HTML reais (hCount=${teoriaChecks.hCount})`);
    assert.equal(teoriaChecks.hasRawMd, false, 'Teoria não pode conter Markdown cru (# / ---) no texto visível');
    assert.equal(teoriaChecks.hasRawHabId, false, `Chips Pré-Porta devem mostrar títulos legíveis, não IDs crus: ${teoriaChecks.chipTexts.join(', ')}`);
    await assertNoBrowserDefaultButtons(page, 'teoria');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_teoria.png` });

    // 9. Logbook & Pontos Cegos
    await page.locator('#wsMainSectionNav [data-section="logbook"]').click();
    await delay(100);
    const wsHtmlLogbook = await page.locator('#appSectionWorkspace').innerHTML();
    assert.ok(wsHtmlLogbook.includes('Radar') || wsHtmlLogbook.includes('Ensaio Mental'));
    assert.equal(wsHtmlLogbook.includes('[object Object]'), false, 'Logbook não pode renderizar [object Object]');
    await assertNoBrowserDefaultButtons(page, 'logbook');
    await assertVisibleInputsLabeled(page, 'logbook');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_logbook.png` });

    // 10. Hoje (6º Ano)
    await page.locator('#wsMainSectionNav [data-section="hoje"]').click();
    await delay(100);
    const wsHtmlHoje = await page.locator('#appSectionWorkspace').innerHTML();
    assert.ok(wsHtmlHoje.includes('70 / 30') || wsHtmlHoje.includes('70/30'));
    await assertNoBrowserDefaultButtons(page, 'hoje');
    await assertVisibleInputsLabeled(page, 'hoje');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/fixed_hoje.png` });

    // 11. Config & Backup v2
    await page.locator('#wsBtnConfig').click();
    await delay(100);
    assert.equal(await page.locator('#cfgExportBackupBtn').count(), 1, 'Config deve exibir Exportar Backup v2');
    await assertNoBrowserDefaultButtons(page, 'config');

    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    assert.equal(swSupported, true);
    assert.deepEqual(errors, [], `Erros inesperados no Desktop: ${errors.join('; ')}`);

    await context.close();

    // =========================================================================
    // MOBILE (390x844)
    // =========================================================================
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', (err) => mobileErrors.push(err.message));

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    const mobileBtns = await mobilePage.locator('#mobileBottomBar .mobile-bar-btn').count();
    assert.equal(mobileBtns, 4, 'Barra inferior mobile deve ter 4 botões');
    await mobilePage.locator('#mobilePrePortaBtn').click();
    await delay(80);
    await mobilePage.locator('#mobileSearchBtn').click();
    await delay(80);
    assert.equal(await mobilePage.locator('#cmdOverlay.open').count(), 1, 'Busca mobile deve abrir Ctrl+K modal');
    assert.deepEqual(mobileErrors, [], `Erros inesperados no Mobile: ${mobileErrors.join('; ')}`);
    await mobileCtx.close();

    await browser.close();
    console.log('✅ E2E Completo (Desktop 7 seções + Contraste + Fontes + Teoria Markdown + Labels + Mobile 390x844) PASSOU!');
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('❌ Falha no E2E:', err);
  process.exit(1);
});
