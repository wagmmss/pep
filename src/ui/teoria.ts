import { FORMACAO_TEORICA_MODULOS } from '../engine/central6ano.ts';
import { resolveLinksForTeoriaModule } from '../data/clinical_links.ts';
import { formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import { getCentral6AnoState, uiBridge, updateCentral6AnoState } from './context.ts';
import { escapeHtml, showToast } from './utils.ts';

interface ModuleExercise {
  id: string;
  prompt: string;
  placeholder: string;
}

const MODULE_EXERCISES: Record<string, ModuleExercise[]> = {
  'mod-01': [
    { id: 'ex-01-a', prompt: 'Escreva 1 frase de Abertura + Captura de Agenda para paciente poliqueixoso:', placeholder: 'Ex.: Além da dor no peito, há mais algo que gostaria de resolver hoje?' },
    { id: 'ex-01-b', prompt: 'Formule uma pergunta para explorar FICE (Medos/Expectativas) sem induzir:', placeholder: 'Ex.: O que mais te preocupa que possa estar causando isso?' },
  ],
  'mod-02': [
    { id: 'ex-02-a', prompt: 'Descreva um Exame Físico normal em padrão HDPE (sem ping-pong):', placeholder: 'BEG, LOTE, corado, hidratado...' },
    { id: 'ex-02-b', prompt: 'Cite 1 sinal de alta Razão de Verossimilhança (LR+) do seu rodízio atual:', placeholder: 'Ex.: B3 para IC, Murphy...' },
  ],
  'mod-03': [
    { id: 'ex-03-a', prompt: 'Transforme um caso recente em One-Liner com qualificadores semânticos:', placeholder: 'Homem, 64a, tabagista, com dispneia progressiva subaguda...' },
    { id: 'ex-03-b', prompt: 'Qual diagnóstico letal ("não posso perder") e qual viés cognitivo evitar?', placeholder: 'Ex.: TEP / Viés de ancoragem...' },
  ],
  'mod-04': [
    { id: 'ex-04-a', prompt: 'Estruture um caso em SBAR (Situação, Background, Avaliação, Recomendação) em 4 linhas:', placeholder: 'S: ... B: ... A: ... R: ...' },
  ],
  'mod-05': [
    { id: 'ex-05-a', prompt: 'Liste os 3 primeiros passos que você sempre esquece ao laudar ECG ou RX:', placeholder: 'Ex.: Calibração, rotação/penetração, seios costofrênicos...' },
  ],
  'mod-06': [
    { id: 'ex-06-a', prompt: 'Quais das 7 Travas de Prescrição você aplica antes de assinar uma receita pediátrica/renal?', placeholder: 'Ex.: Peso em kg, teto adulto, ClCr...' },
  ],
  'mod-07': [
    { id: 'ex-07-a', prompt: 'Descreva o Plano B (contingência) de um procedimento do seu rodízio atual:', placeholder: 'Ex.: Se falha na IOT, chamar ajuda + máscara laríngea...' },
  ],
};

let activeModId = FORMACAO_TEORICA_MODULOS[0]?.id || 'mod-01';

export function renderTeoriaSection(container: HTMLElement, initialModId?: string): void {
  if (initialModId && FORMACAO_TEORICA_MODULOS.some((m) => m.id === initialModId)) {
    activeModId = initialModId;
  }

  const mod = FORMACAO_TEORICA_MODULOS.find((m) => m.id === activeModId) || FORMACAO_TEORICA_MODULOS[0];
  if (!mod) return;

  const c6 = getCentral6AnoState();
  const isRead = (c6.teoriaStatusById?.[mod.id] || 'nao_iniciado') !== 'nao_iniciado';
  const links = resolveLinksForTeoriaModule(mod.id);
  const exercises = MODULE_EXERCISES[mod.id] || [
    { id: `ex-${mod.id}-1`, prompt: 'Síntese prática (1 ação imediata para o próximo plantão):', placeholder: 'Anote sua regra de bolso...' },
  ];

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>📚 Formação Teórica (7 Módulos)</h2>
          <p class="mq-workspace-sub">Base conceitual do 6º ano com vínculo direto ao Pré-Porta e exercícios práticos salvos localmente.</p>
        </div>
        <button type="button" class="btn ${isRead ? 'btn-primary' : 'btn-secondary'} btn-sm" id="teoriaMarkReadBtn">
          ${isRead ? '✅ Módulo Concluído' : '☑️ Marcar como Estudado'}
        </button>
      </header>

      <div class="mq-teoria-layout">
        <aside class="mq-teoria-nav" id="teoriaModulesNav">
          ${FORMACAO_TEORICA_MODULOS.map((m) => {
            const done = (c6.teoriaStatusById?.[m.id] || 'nao_iniciado') !== 'nao_iniciado';
            return `
              <button type="button" class="mq-teoria-nav-btn${m.id === mod.id ? ' active' : ''}" data-mod-id="${escapeHtml(m.id)}">
                <span>${escapeHtml(m.num)}. ${escapeHtml(m.shortTitle)}</span>
                ${done ? '<span>✅</span>' : ''}
              </button>
            `;
          }).join('')}
        </aside>

        <article class="mq-panel-card mq-teoria-content">
          <div class="teoria-head">
            <h3>${escapeHtml(mod.title)}</h3>
            <p class="mq-hint">${escapeHtml(mod.pilar)}</p>
          </div>

          ${
            links.habIds.length > 0
              ? `<div class="hab-links-row" style="margin-bottom:12px;">
                  ${links.habIds
                    .map(
                      (hid) =>
                        `<button type="button" class="pep-link-chip chip-preporta" data-open-hab="${escapeHtml(hid)}">🧠 Pré-Porta ${escapeHtml(hid)}</button>`
                    )
                    .join('')}
                </div>`
              : ''
          }

          <div class="teoria-sections">
            <div class="guia-section-body">${formatGuiaInlineHtml(mod.markdown)}</div>
          </div>

          <section class="teoria-exercises-box">
            <h4>✍️ Exercícios Práticos do Módulo (Salvos Localmente)</h4>
            ${exercises
              .map((ex) => {
                const doneFlag = Boolean(c6.teoriaExercisesDone?.[ex.id]);
                const savedText = localStorage.getItem(`mq_teoria_ans_${ex.id}`) || '';
                return `
                  <div class="teoria-ex-item">
                    <label class="teoria-ex-label">
                      <input type="checkbox" data-ex-check="${escapeHtml(ex.id)}" ${doneFlag ? 'checked' : ''} />
                      <span>${escapeHtml(ex.prompt)}</span>
                    </label>
                    <textarea class="mq-textarea" rows="2" data-ex-text="${escapeHtml(ex.id)}" placeholder="${escapeHtml(ex.placeholder)}">${escapeHtml(savedText)}</textarea>
                  </div>
                `;
              })
              .join('')}
            <button type="button" class="btn btn-primary btn-xs" id="teoriaSaveExBtn">💾 Salvar Respostas</button>
          </section>
        </article>
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-mod-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModId = btn.dataset.modId!;
      renderTeoriaSection(container);
    });
  });

  container.querySelector('#teoriaMarkReadBtn')?.addEventListener('click', () => {
    updateCentral6AnoState((prev) => {
      const cur = prev.teoriaStatusById?.[mod.id] || 'nao_iniciado';
      const nextStatus = cur === 'nao_iniciado' ? 'estudado' : 'nao_iniciado';
      return {
        ...prev,
        teoriaStatusById: { ...(prev.teoriaStatusById || {}), [mod.id]: nextStatus },
      };
    });
    renderTeoriaSection(container);
  });

  container.querySelectorAll<HTMLButtonElement>('[data-open-hab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hid = btn.dataset.openHab;
      if (hid) {
        uiBridge.navigate('preporta', { itemId: hid });
        uiBridge.selectPrePortaCard(hid);
      }
    });
  });

  container.querySelectorAll<HTMLInputElement>('[data-ex-check]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const exId = chk.dataset.exCheck!;
      updateCentral6AnoState((prev) => ({
        ...prev,
        teoriaExercisesDone: { ...prev.teoriaExercisesDone, [exId]: chk.checked },
      }));
    });
  });

  container.querySelector('#teoriaSaveExBtn')?.addEventListener('click', () => {
    container.querySelectorAll<HTMLTextAreaElement>('[data-ex-text]').forEach((ta) => {
      const exId = ta.dataset.exText!;
      localStorage.setItem(`mq_teoria_ans_${exId}`, ta.value);
      if (ta.value.trim()) {
        updateCentral6AnoState((prev) => ({
          ...prev,
          teoriaExercisesDone: { ...prev.teoriaExercisesDone, [exId]: true },
        }));
      }
    });
    renderTeoriaSection(container);
    showToast('✅ Exercícios salvos localmente!', 'success');
  });

  uiBridge.selectTeoriaModule = (modId: string) => {
    activeModId = modId;
    renderTeoriaSection(container);
  };
}
