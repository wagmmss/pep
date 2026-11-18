import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

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
    throw new Error('playwright-core não encontrado. Rode via `npx --yes -p playwright-core node tests/e2e_cockpit.mjs`.');
  }
}
const { chromium } = loadPlaywrightCore();

const ROOT = process.cwd();
const PORT = 4173;
const BASE_URL = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;

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

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timeout aguardando servidor preview em ${url}`);
}

async function run() {
  let serverProc = null;
  if (!process.env.E2E_URL) {
    serverProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    await waitForServer(BASE_URL);
  }

  const executablePath = findChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ========================================================================
    // 1. DESKTOP (1440x900)
    // ========================================================================
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`console.error: ${msg.text()}`);
      }
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#wsMainSectionNav [data-section="pep"]', { timeout: 5000 }).catch(() => {
      throw new Error(`Sidebar não hidratou. Erros: ${JSON.stringify(errors)}`);
    });

    // 2 blocos na sidebar & remoção de Habilidades (22) do filtro PEP
    const sidebarGroups = await page.locator('#wsMainSectionNav .ws-nav-group').count();
    assert.equal(sidebarGroups, 2, 'Sidebar deve exibir os 2 blocos');
    const sidebarText = (await page.locator('#wsMainSectionNav').textContent()) || '';
    assert.ok(sidebarText.includes('Protocolos PEP') && sidebarText.includes('Hoje (6º Ano)'), `Sidebar texto inesperado: ${sidebarText}`);
    assert.equal(await page.locator('#moduleTabs [data-mod="hab"]').count(), 0, 'Filtro PEP não deve ter botão Habilidades (22)');

    // 88 cards PEP renderizados
    const cardCount = await page.locator('#cardsGrid .protocol-card').count();
    assert.equal(cardCount, 88, `Esperado 88 cards PEP no grid inicial, encontrado ${cardCount}`);

    // Toggle Consulta / Treino + Abrir PEP Pediatria + Doses Pediátricas + Power Actions + Novo Paciente
    await page.locator('#clinicalModeToggle').click();
    await page.locator('#moduleTabs [data-mod="ped"]').click();
    assert.equal(await page.locator('#cardsGrid .protocol-card').count(), 13, 'Filtro Pediatria deve exibir 13 PEPs');

    await page.locator('#wsSearchInput').fill(';ped-otite');
    await page.waitForTimeout(150);
    await page.locator('#cardsGrid .protocol-card').first().click();
    await page.waitForSelector('#drawerOverlay.open', { state: 'attached' });

    // Modo Treino dentro do PEP
    const drawerHtmlTreino = await page.locator('#drawerInteractivePanel').innerHTML();
    assert.ok(drawerHtmlTreino.includes('pepRegisterLogbookBtn') || drawerHtmlTreino.includes('Formação Teórica'), 'Modo Treino deve exibir vínculos de estudo/Logbook');

    await page.locator('#pepIdPeso').fill('15');
    await page.locator('#pepIdPeso').dispatchEvent('change');
    await page.waitForTimeout(100);
    await page.locator('[data-power-action="1"]').waitFor();
    await page.locator('#pepAddCartBtn').click();
    await page.waitForTimeout(200);
    const cartCountText = (await page.locator('#cartItemCountBadge').textContent())?.trim() || '';
    assert.ok(Number(cartCountText) >= 1, `Carrinho deve registrar >= 1 item (drawerTitle=${await page.locator('#drawerTitle').textContent()}, badge=${cartCountText})`);

    // Limpar sessão com 🧹 Novo Paciente
    await page.locator('#drawerCloseBtn').click();
    await page.locator('#wsClearSearchBtn').click();
    await page.locator('#btnNovoPaciente').click();
    await page.waitForTimeout(200);
    assert.equal((await page.locator('#cartItemCountBadge').textContent())?.trim(), '0', 'Novo Paciente deve zerar o carrinho');

    // Ctrl+K estratificado
    await page.locator('#topbarSearchBtn').click();
    await page.waitForSelector('#cmdOverlay.open', { state: 'attached' });
    await page.locator('#cmdSearchInput').fill(';sca');
    await page.waitForTimeout(150);
    assert.ok((await page.locator('#cmdResults [data-cmd-type="pep"]').count()) >= 1, 'Ctrl+K deve encontrar PEP por ;atalho');
    await page.locator('#cmdCloseBtn').click();

    // REMUME/HSL & Calculadoras Modal
    await page.locator('#wsBtnRemumeCalc').click();
    await page.waitForSelector('#remumeCalcOverlay.open', { state: 'attached' });
    await page.locator('#pharmaSearchInput').fill('amoxicilina');
    await page.waitForTimeout(150);
    await page.locator('#pharmaSrcHsl').click();
    await page.waitForTimeout(300);
    await page.locator('[data-rc-tab="calc"]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-rc-tab="gaso"]').click();
    await page.waitForTimeout(150);
    await page.locator('#remumeCalcCloseBtn').click();

    // Pré-Porta 30s (22), Ferramentas, Hoje, Logbook, Config
    await page.locator('#wsMainSectionNav [data-section="preporta"]').click();
    await page.waitForTimeout(150);
    const wsHtmlPrePorta = await page.locator('#appSectionWorkspace').innerHTML();
    assert.ok(wsHtmlPrePorta.includes('Pré-Porta') || wsHtmlPrePorta.includes('Técnica Profunda') || wsHtmlPrePorta.includes('CRÍTICO'));

    await page.locator('#wsMainSectionNav [data-section="ferramentas"]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-ftab="exames"]').click();
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('ECG (10 Passos)'));
    await page.locator('[data-ftab="raciocinio"]').click();
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('Construtor Guiado de Raciocínio Clínico'));
    await page.locator('[data-ftab="oratoria"]').click();
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#appSectionWorkspace').textContent())?.includes('Modo Palco'));

    await page.locator('#wsMainSectionNav [data-section="logbook"]').click();
    await page.waitForTimeout(150);
    const wsHtmlLogbook = await page.locator('#appSectionWorkspace').innerHTML();
    assert.ok(wsHtmlLogbook.includes('Radar') || wsHtmlLogbook.includes('Ensaio Mental'));

    await page.locator('#wsMainSectionNav [data-section="hoje"]').click();
    await page.waitForTimeout(150);
    const wsHtmlHoje = await page.locator('#appSectionWorkspace').innerHTML();
    assert.ok(wsHtmlHoje.includes('70/30') || wsHtmlHoje.includes('Timer'));

    await page.locator('#wsBtnConfig').click();
    await page.waitForTimeout(150);
    assert.ok((await page.locator('#cfgExportBackupBtn').count()) === 1, 'Config deve exibir botão Exportar Backup v2');

    // Service Worker check
    const swSupported = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return Array.isArray(regs);
    });
    assert.equal(swSupported, true);

    assert.deepEqual(errors, [], `Erros inesperados no Desktop: ${errors.join('; ')}`);
    await context.close();

    // ========================================================================
    // 2. MOBILE (390x844)
    // ========================================================================
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', (err) => mobileErrors.push(`pageerror: ${err.message}`));
    mobilePage.on('console', (msg) => {
      if (msg.type() === 'error') mobileErrors.push(`console.error: ${msg.text()}`);
    });

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    const mobileBtns = await mobilePage.locator('#mobileBottomBar .mobile-bar-btn').count();
    assert.equal(mobileBtns, 4, 'Barra inferior mobile deve ter exatamente 4 botões');
    await mobilePage.locator('#mobilePrePortaBtn').click();
    await mobilePage.waitForTimeout(150);
    await mobilePage.locator('#mobileSearchBtn').click();
    await mobilePage.waitForSelector('#cmdOverlay.open');

    assert.deepEqual(mobileErrors, [], `Erros inesperados no Mobile: ${mobileErrors.join('; ')}`);
    await mobileCtx.close();

    console.log('✅ E2E Playwright Desktop (1440x900) + Mobile (390x844) concluído com 0 erros!');
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

run().catch((err) => {
  console.error('❌ E2E falhou:', err);
  process.exit(1);
});
