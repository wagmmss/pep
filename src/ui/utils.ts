import { escapeHtml } from '../engine/diretrizes.ts';
import { detectPiiWarnings, sanitizePiiText } from '../state/store.ts';

export { escapeHtml };

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let sharedAudioContext: AudioContext | null = null;

export interface DebouncedFn<T extends (...args: never[]) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  const wrapped = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(invoke, delayMs);
  }) as DebouncedFn<T>;

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  wrapped.flush = () => {
    invoke();
  };

  return wrapped;
}

export function showToast(
  message: string,
  variant: 'info' | 'success' | 'warning' | 'danger' = 'info',
  durationMs = 2200
): void {
  const el = document.getElementById('cockpitToast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show toast-${variant}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, durationMs);
}

export function triggerHaptic(pattern: number | number[] = 14): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore in unsupported browsers
  }
}

export async function copyToClipboard(text: string, label = 'Texto'): Promise<boolean> {
  const clean = String(text || '');
  if (!clean.trim()) {
    showToast('Nada para copiar.', 'warning');
    return false;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(clean);
    } else {
      const ta = document.createElement('textarea');
      ta.value = clean;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    triggerHaptic(15);
    showToast(`✅ ${label} copiado!`, 'success', 1800);
    return true;
  } catch {
    showToast('Não foi possível acessar a área de transferência.', 'danger');
    return false;
  }
}

/**
 * Validação anti-PII LGPD antes de salvar ou exportar usando modal acessível no DOM (sem window.confirm).
 * Retorna o texto (possivelmente sanitizado) ou null se o usuário optar por editar manualmente.
 */
export function guardPiiBeforeSave(text: string, contextLabel = 'registro'): Promise<string | null> {
  const warnings = detectPiiWarnings(text);
  if (warnings.length === 0) return Promise.resolve(text);

  if (typeof document === 'undefined' || !document.body) {
    return Promise.resolve(sanitizePiiText(text));
  }

  return new Promise((resolve) => {
    const existing = document.getElementById('piiConfirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'piiConfirmOverlay';
    overlay.className = 'shortcuts-overlay open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Alerta LGPD Anti-PII');

    const warningsListHtml = warnings
      .map((w) => `<div class="shortcut-row">• ${escapeHtml(w.message)}</div>`)
      .join('');

    overlay.innerHTML = `
      <div class="shortcuts-modal">
        <div class="shortcuts-header">
          <div>
            <h3>⚠️ Alerta LGPD (Anti-PII)</h3>
            <p>Dados identificáveis detectados no ${escapeHtml(contextLabel)}</p>
          </div>
          <button type="button" class="close-btn" id="piiModalCloseBtn" aria-label="Fechar">✕</button>
        </div>
        <div class="shortcuts-body">
          <div class="shortcuts-group">${warningsListHtml}</div>
          <p class="mq-hint">Remova automaticamente os identificadores sensíveis antes de gravar ou volte para editar manualmente.</p>
          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="piiModalSanitizeBtn">🛡️ Remover dados sensíveis e salvar</button>
            <button type="button" class="btn btn-ghost btn-sm" id="piiModalCancelBtn">Voltar e editar</button>
          </div>
        </div>
      </div>
    `;

    const cleanup = (result: string | null) => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup(null);
      }
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });
    overlay.querySelector('#piiModalCloseBtn')?.addEventListener('click', () => cleanup(null));
    overlay.querySelector('#piiModalCancelBtn')?.addEventListener('click', () => cleanup(null));
    overlay.querySelector('#piiModalSanitizeBtn')?.addEventListener('click', () => {
      cleanup(sanitizePiiText(text));
    });

    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    overlay.querySelector<HTMLButtonElement>('#piiModalSanitizeBtn')?.focus();
  });
}

export function printReceiptDocument(title: string, bodyText: string, patientName?: string): void {
  const area = document.getElementById('printReceiptArea');
  if (!area) {
    window.print();
    return;
  }
  const nowStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const patientLine = patientName?.trim()
    ? `<p class="print-patient"><strong>Paciente:</strong> ${escapeHtml(patientName.trim())}</p>`
    : '';
  area.innerHTML = `
    <div class="print-sheet">
      <header class="print-header">
        <div>
          <h1>RECEITUÁRIO / ORIENTAÇÕES CLÍNICAS</h1>
          <p class="print-subtitle">${escapeHtml(title)}</p>
        </div>
        <div class="print-date">Data: ${escapeHtml(nowStr)}</div>
      </header>
      ${patientLine}
      <pre class="print-body">${escapeHtml(bodyText.trim())}</pre>
      <footer class="print-footer">
        <div class="print-sign-line">__________________________________________</div>
        <div class="print-sign-label">Assinatura / Carimbo / CRM</div>
      </footer>
    </div>
  `;
  window.print();
}

export function playWebAudioChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.14;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  } catch {
    // Ignore audio errors when blocked
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
