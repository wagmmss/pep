import {
  buildContextualAiPrompt,
  FORMACAO_TEORICA_MODULOS,
} from '../engine/central6ano.ts';
import { renderTeoriaMarkdownToHtml } from '../engine/diretrizes.ts';
import { resolveLinksForTeoriaModule } from '../data/clinical_links.ts';
import {
  getCentral6AnoState,
  PROTOCOL_BY_ID,
  uiBridge,
  updateCentral6AnoState,
} from './context.ts';
import { copyToClipboard, escapeHtml, guardPiiBeforeSave, showToast } from './utils.ts';

export { renderTeoriaMarkdownToHtml };

export function initTeoria(): { render: (container: HTMLElement, subTab?: string) => void } {
  const render = (container: HTMLElement, subTab?: string) => {
    const state = getCentral6AnoState();
    const activeModId = subTab || state.activeTeoriaModId || FORMACAO_TEORICA_MODULOS[0]?.id || 'mod-01';
    const mod = FORMACAO_TEORICA_MODULOS.find((m) => m.id === activeModId) || FORMACAO_TEORICA_MODULOS[0];
    if (!mod) return;

    if (mod.id !== state.activeTeoriaModId) {
      updateCentral6AnoState((s) => ({ ...s, activeTeoriaModId: mod.id }));
    }

    const latestState = getCentral6AnoState();
    const statusMap = latestState.teoriaStatusById || {};
    const modStatus = statusMap[mod.id] || 'nao_iniciado';
    const links = resolveLinksForTeoriaModule(mod.id);
    const mergedHabIds = Array.from(new Set([...(mod.relatedHabIds || []), ...links.habIds]));
    const domCount = FORMACAO_TEORICA_MODULOS.filter(
      (m) => (statusMap[m.id] || 'nao_iniciado') === 'dominado'
    ).length;

    const exDone = Boolean(latestState.teoriaExercisesDone?.[mod.id]);
    const exNotes = latestState.teoriaExercisesNotes?.[mod.id] || '';

    const relatedHabHtml =
      mergedHabIds.length > 0
        ? mergedHabIds
            .map((hid) => {
              const habCard = PROTOCOL_BY_ID.get(hid);
              const label = habCard ? habCard.title : hid;
              return `<button type="button" class="chip-preporta" data-open-hab="${escapeHtml(hid)}">🧠 ${escapeHtml(label)}</button>`;
            })
            .join('')
        : `<span class="mq-hint">Nenhum cartão Pré-Porta específico vinculado.</span>`;

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CURRÍCULO TEÓRICO AVANÇADO · 7 DOMÍNIOS COMPLETOS</div>
            <h2 class="mq-workspace-title">📚 Formação Teórica em Habilidades Médicas</h2>
            <p class="mq-workspace-sub">Leitura clínica em ~72ch · Link bidirecional com os 22 Cartões Pré-Porta 30s · Controle de Domínio</p>
          </div>
          <div class="mq-btn-row">
            <span class="mq-nav-badge">${domCount}/${FORMACAO_TEORICA_MODULOS.length} Dominados</span>
            <button type="button" class="btn-palette-trigger" id="teoriaZenBtn">🧘 Modo Zen (Alt+Z)</button>
            <button type="button" class="btn-palette-trigger" id="teoriaGoPrePortaBtn">🧠 Ver Cartões Pré-Porta 30s</button>
          </div>
        </header>

        <div class="mq-teoria-shell">
          <aside class="mq-teoria-nav" aria-label="Índice dos 7 Módulos Teóricos">
            ${FORMACAO_TEORICA_MODULOS.map((m) => {
              const st = statusMap[m.id] || 'nao_iniciado';
              const badge = st === 'dominado' ? '🏆 Dominado' : st === 'estudado' ? '📖 Estudado' : '⏳ Pendente';
              const isAct = m.id === mod.id;
              return `
                <button type="button" class="mq-teoria-card-btn${isAct ? ' active' : ''}" data-teoria-mod="${escapeHtml(m.id)}">
                  <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:6px;">
                    <span class="mq-stat-label" style="color:${escapeHtml(m.areaColor || 'var(--primary-bright)')};">MÓDULO ${escapeHtml(m.num)}</span>
                    <span class="mq-nav-badge">${badge}</span>
                  </div>
                  <div style="font-weight:700; font-size:0.86rem; line-height:1.3;">${escapeHtml(m.shortTitle)}</div>
                  <div class="mq-hint">${escapeHtml(m.pilar)}</div>
                </button>`;
            }).join('')}
          </aside>

          <div class="mq-teoria-reader-wrap">
            <div class="teoria-head">
              <div>
                <span class="mq-eyebrow">${escapeHtml(mod.pilar)}</span>
                <div class="mq-hint" style="font-family:var(--font-mono);">${escapeHtml(mod.fileName)}</div>
              </div>
              <div class="mq-btn-row" id="teoriaStatusBtns">
                <button type="button" class="mq-counter-btn${modStatus === 'nao_iniciado' ? ' is-active' : ''}" data-tstatus="nao_iniciado">⏳ Não iniciado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'estudado' ? ' is-active' : ''}" data-tstatus="estudado" id="teoriaMarkReadBtn">📖 Estudado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'dominado' ? ' is-active' : ''}" data-tstatus="dominado">🏆 Dominado</button>
              </div>
            </div>

            <div class="teoria-exercises-box" style="margin-top:0; margin-bottom:18px;">
              <div class="mq-stat-label" style="margin-bottom:8px;">🔗 Cartões Pré-Porta 30s Conectados (Clique para abrir):</div>
              <div class="hab-links-row">${relatedHabHtml}</div>
              <div class="mq-btn-row" style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--line-subtle);">
                <span class="mq-hint" style="font-weight:700;">🎭 Treinar Módulo com IA (1 Clique):</span>
                <button type="button" class="mq-counter-btn" data-ai-prompt="paciente">Paciente Simulado</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="oratoria">Preceptor SNAPPS/SBAR</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="raciocinio">Caso em 3 Etapas (Bayes)</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="osce">Estação OSCE</button>
              </div>
            </div>

            <article class="mq-prose-clinical" id="teoriaReaderArticle">
              ${renderTeoriaMarkdownToHtml(mod.markdown)}
            </article>

            <div class="teoria-exercises-box">
              <div class="mq-stat-label">✍️ Registro Local do Exercício Prático (Incluído no Backup v2 · Anti-PII)</div>
              <div class="teoria-ex-item">
                <label class="teoria-ex-label">
                  <input type="checkbox" id="teoriaExDoneChk" ${exDone ? 'checked' : ''} />
                  <span>Exercício prático do Módulo ${escapeHtml(mod.num)} concluído</span>
                </label>
              </div>
              <div class="mq-control-group" style="margin-top:10px;">
                <label class="mq-control-label" for="teoriaExNotesInput">Síntese pessoal, dúvidas ou lacunas encontradas:</label>
                <textarea id="teoriaExNotesInput" class="mq-textarea" rows="3" placeholder="Ex.: Principais pontos cegos no cálculo de Δ/Δ ou HINTS à beira do leito...">${escapeHtml(exNotes)}</textarea>
              </div>
              <div class="mq-btn-row" style="margin-top:8px;">
                <button type="button" class="btn btn-primary btn-xs" id="teoriaSaveExBtn">💾 Salvar Exercício</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#teoriaZenBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:toggle-zen'));
    });

    container.querySelector('#teoriaGoPrePortaBtn')?.addEventListener('click', () => {
      uiBridge.navigate('preporta');
    });

    container.querySelectorAll<HTMLButtonElement>('[data-teoria-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.teoriaMod!;
        render(container, id);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-tstatus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.dataset.tstatus as 'nao_iniciado' | 'estudado' | 'dominado';
        updateCentral6AnoState((prev) => ({
          ...prev,
          teoriaStatusById: {
            ...prev.teoriaStatusById,
            [mod.id]: st,
          },
        }));
        showToast(
          st === 'dominado'
            ? `🏆 Módulo ${mod.num} marcado como Dominado!`
            : st === 'estudado'
              ? `📖 Módulo ${mod.num} marcado como Estudado.`
              : `Módulo ${mod.num} reiniciado.`,
          'success'
        );
        render(container, mod.id);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-open-hab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hid = btn.dataset.openHab!;
        uiBridge.navigate('preporta', { itemId: hid });
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.aiPrompt as 'paciente' | 'oratoria' | 'raciocinio' | 'osce';
        const prompt = buildContextualAiPrompt(kind, getCentral6AnoState());
        void copyToClipboard(prompt, `Prompt ${kind.toUpperCase()}`);
      });
    });

    container.querySelector('#teoriaSaveExBtn')?.addEventListener('click', async () => {
      const done = Boolean((container.querySelector('#teoriaExDoneChk') as HTMLInputElement | null)?.checked);
      const rawNotes = (container.querySelector('#teoriaExNotesInput') as HTMLTextAreaElement | null)?.value || '';
      const safeNotes = await guardPiiBeforeSave(rawNotes, 'Exercício Teórico');
      if (safeNotes === null) return;

      updateCentral6AnoState((prev) => ({
        ...prev,
        teoriaExercisesDone: {
          ...(prev.teoriaExercisesDone || {}),
          [mod.id]: done,
        },
        teoriaExercisesNotes: {
          ...(prev.teoriaExercisesNotes || {}),
          [mod.id]: safeNotes,
        },
      }));
      const ta = container.querySelector<HTMLTextAreaElement>('#teoriaExNotesInput');
      if (ta && ta.value !== safeNotes) ta.value = safeNotes;
      showToast('Exercício salvo com segurança (incluído no Backup v2).', 'success');
    });
  };

  return { render };
}
