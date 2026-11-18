import { escapeHtml } from '../engine/diretrizes.ts';
import { detectPiiWarnings, sanitizePiiText } from '../state/store.ts';

export { escapeHtml };

let toastTimer: ReturnType<typeof setTimeout> | null = null;

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
 * Validação anti-PII LGPD antes de salvar ou exportar.
 * Retorna o texto (possivelmente sanitizado) ou null se o usuário cancelar.
 */
export function guardPiiBeforeSave(text: string, contextLabel = 'registro'): string | null {
  const warnings = detectPiiWarnings(text);
  if (warnings.length === 0) return text;
  const summary = warnings.map((w) => `• ${w.message}`).join('\n');
  const shouldSanitize = window.confirm(
    `⚠️ Alerta LGPD (Anti-PII) no ${contextLabel}:\n\n${summary}\n\nClique OK para remover automaticamente os dados sensíveis antes de salvar, ou Cancelar para editar manualmente.`
  );
  if (!shouldSanitize) return null;
  return sanitizePiiText(text);
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
    const ctx = new AudioCtx();
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
