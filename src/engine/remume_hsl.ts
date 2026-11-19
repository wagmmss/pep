import { REMUME_ITEMS, type RemumeItem } from '../data/remume.ts';

export const NO_HSL_FICHA_NOTICE = 'Sem ficha HSL — preencher posologia manual';
export const HSL_GUIA_PUBLIC_PATH = 'data/hsl-guia.json';

export type PharmaSource = 'remume' | 'hsl';
export type PatientProfile = 'adulto' | 'pediatria';

export interface HslDrug {
  id: number;
  farmaco: string;
  nome_normalizado: string;
  na_remume: boolean;
  apresentacoes_remume: string[];
  apresentacoes_hsl: string[];
  indicacoes: string;
  dose_adulto: string;
  dose_pediatria: string;
  dose_maxima: string;
  ajuste_dose: string;
  administracao: string;
  preparo_diluicao: string;
  contraindicacoes: string;
  gestacao_lactacao: string;
}

export interface HslGuiaCatalog {
  metadados: {
    fonte: string;
    url_oficial: string;
    total_medicamentos: number;
    total_na_remume_hsl: number;
    total_remume_vinculados: number;
    total_remume_itens: number;
  };
  medicamentos: HslDrug[];
}

export interface PharmaSearchResult {
  source: PharmaSource;
  title: string;
  subtitle: string;
  naRemume: boolean;
  hasHslFicha: boolean;
  notice: string | null;
  remumeItem?: RemumeItem;
  hslDrug?: HslDrug;
}

export interface SearchPharmaOptions {
  source?: PharmaSource;
  limit?: number;
  hslDrugs?: HslDrug[];
}

export interface PrescriptionPreviewOptions {
  profile?: PatientProfile;
  selectedPresentation?: string;
  weightKg?: number;
}

export interface PrescriptionPreview {
  title: string;
  profile: PatientProfile;
  naRemume: boolean;
  hasHslFicha: boolean;
  isPlaceholder: boolean;
  notice: string | null;
  apresentacao: string;
  posologia: string;
  doseMaxima: string;
  ajusteDose: string;
  administracao: string;
  preparoDiluicao: string;
  contraindicacoes: string;
  gestacaoLactacao: string;
  editableText: string;
}

interface PrecomputedHslEntry {
  drug: HslDrug;
  primaryNorm: string;
  secondaryNorm: string;
}

interface PrecomputedHslCache {
  indexById: Map<number, HslDrug>;
  entries: PrecomputedHslEntry[];
}

let cachedHslDrugs: HslDrug[] | null = null;
const inFlightHslByUrl = new Map<string, Promise<HslDrug[]>>();
const hslCacheByArray = new WeakMap<readonly HslDrug[], PrecomputedHslCache>();

/**
 * Normaliza texto farmacológico para busca:
 * remove diacríticos, converte vírgula decimal em ponto e separa número + unidade (ex: "500mg" -> "500 mg").
 */
export function normalizePharmaText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/,/g, '.')
    .replace(/(\d)(mg|mcg|g|ml|ui|%)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const PRECOMPUTED_REMUME: ReadonlyArray<{ item: RemumeItem; normText: string }> = REMUME_ITEMS.map((item) => ({
  item,
  normText: `${normalizePharmaText(item.norm || item.name)} ${normalizePharmaText(item.hslFarmaco ?? '')}`.trim(),
}));

/** Constrói índice por ID para busca O(1) nas fichas do Guia HSL. */
function buildHslIndex(hslDrugs: readonly HslDrug[]): Map<number, HslDrug> {
  const index = new Map<number, HslDrug>();
  for (let i = 0; i < hslDrugs.length; i++) {
    index.set(hslDrugs[i].id, hslDrugs[i]);
  }
  return index;
}

function getOrBuildHslCache(hslDrugs: readonly HslDrug[]): PrecomputedHslCache {
  const existing = hslCacheByArray.get(hslDrugs);
  if (existing) return existing;

  const indexById = buildHslIndex(hslDrugs);
  const entries: PrecomputedHslEntry[] = new Array(hslDrugs.length);
  for (let i = 0; i < hslDrugs.length; i++) {
    const drug = hslDrugs[i];
    entries[i] = {
      drug,
      primaryNorm: normalizePharmaText(`${drug.farmaco} ${drug.nome_normalizado}`),
      secondaryNorm: normalizePharmaText(
        `${drug.apresentacoes_hsl.join(' ')} ${drug.apresentacoes_remume.join(' ')} ${drug.indicacoes}`
      ),
    };
  }
  const cache: PrecomputedHslCache = { indexById, entries };
  hslCacheByArray.set(hslDrugs, cache);
  return cache;
}

/** Carrega e faz cache de public/data/hsl-guia.json sob demanda no navegador com deduplicação in-flight por URL. */
export async function loadHslGuia(
  fetcher: typeof fetch = globalThis.fetch,
  url: string = HSL_GUIA_PUBLIC_PATH
): Promise<HslDrug[]> {
  if (cachedHslDrugs && cachedHslDrugs.length > 0) return cachedHslDrugs;
  const useSharedMap = fetcher === globalThis.fetch;
  if (useSharedMap) {
    const existing = inFlightHslByUrl.get(url);
    if (existing) return existing;
  }

  const request = (async () => {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Falha ao carregar Guia HSL (${response.status})`);
    }
    const data = (await response.json()) as Partial<HslGuiaCatalog> | null;
    if (!data || !Array.isArray(data.medicamentos) || data.medicamentos.length === 0) {
      throw new Error('Catálogo Guia HSL vazio ou malformado.');
    }
    cachedHslDrugs = data.medicamentos;
    getOrBuildHslCache(cachedHslDrugs);
    return cachedHslDrugs;
  })();

  if (useSharedMap) {
    const tracked = request.finally(() => {
      inFlightHslByUrl.delete(url);
    });
    inFlightHslByUrl.set(url, tracked);
    return tracked;
  }

  return request;
}

/** Resolve a ficha HSL vinculada a um item REMUME, se disponível. */
function resolveHslForRemume(
  item: RemumeItem,
  hslSource?: Map<number, HslDrug> | readonly HslDrug[]
): HslDrug | undefined {
  if (item.hslId === undefined || !hslSource) return undefined;
  if (hslSource instanceof Map) {
    return hslSource.get(item.hslId);
  }
  const cache = getOrBuildHslCache(hslSource);
  return cache.indexById.get(item.hslId);
}

function scoreTextMatch(haystackNorm: string, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (haystackNorm.startsWith(token)) {
      score += 40;
    } else if (haystackNorm.includes(` ${token}`)) {
      score += 25;
    } else if (haystackNorm.includes(token)) {
      score += 12;
    } else {
      return 0;
    }
  }
  return score;
}

/** Busca filtrável entre REMUME (252 itens, padrão) e Guia HSL (976 fármacos) com índices pré-normalizados. */
export function searchPharma(
  query: string,
  options: SearchPharmaOptions = {}
): PharmaSearchResult[] {
  const source: PharmaSource = options.source ?? 'remume';
  const limit = options.limit ?? 20;
  const hslDrugs = options.hslDrugs ?? cachedHslDrugs ?? [];
  const hslCache = hslDrugs.length > 0 ? getOrBuildHslCache(hslDrugs) : undefined;
  const qNorm = normalizePharmaText(query);
  const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];

  if (source === 'remume') {
    const scored: Array<{ result: PharmaSearchResult; score: number }> = [];
    for (let i = 0; i < PRECOMPUTED_REMUME.length; i++) {
      const { item, normText } = PRECOMPUTED_REMUME[i];
      const score = scoreTextMatch(normText, tokens);
      if (score === 0) continue;

      const hslDrug = resolveHslForRemume(item, hslCache?.indexById);
      const hasHslFicha = item.hslId !== undefined;
      const notice = hasHslFicha ? null : NO_HSL_FICHA_NOTICE;

      scored.push({
        score: normText.startsWith(qNorm) && qNorm ? score + 30 : score,
        result: {
          source: 'remume',
          title: item.name,
          subtitle: hasHslFicha
            ? `REMUME • Ficha HSL: ${item.hslFarmaco ?? hslDrug?.farmaco ?? ''}`
            : `REMUME • ${NO_HSL_FICHA_NOTICE}`,
          naRemume: true,
          hasHslFicha,
          notice,
          remumeItem: item,
          hslDrug,
        },
      });
    }

    scored.sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title, 'pt-BR'));
    return scored.slice(0, limit).map((entry) => entry.result);
  }

  if (!hslCache) return [];
  const scoredHsl: Array<{ result: PharmaSearchResult; score: number }> = [];
  for (let i = 0; i < hslCache.entries.length; i++) {
    const { drug, primaryNorm, secondaryNorm } = hslCache.entries[i];
    let score = scoreTextMatch(primaryNorm, tokens);

    if (score === 0 && tokens.length > 0) {
      const secScore = scoreTextMatch(secondaryNorm, tokens);
      if (secScore > 0) score = Math.max(1, Math.floor(secScore / 2));
    }

    if (score === 0) continue;
    if (drug.na_remume) score += 5;

    const subtitleParts: string[] = [drug.na_remume ? 'HSL + REMUME' : 'Guia HSL'];
    if (drug.apresentacoes_hsl.length > 0) {
      subtitleParts.push(drug.apresentacoes_hsl[0]);
    }

    scoredHsl.push({
      score,
      result: {
        source: 'hsl',
        title: drug.farmaco,
        subtitle: subtitleParts.join(' • '),
        naRemume: drug.na_remume,
        hasHslFicha: true,
        notice: null,
        hslDrug: drug,
      },
    });
  }

  scoredHsl.sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title, 'pt-BR'));
  return scoredHsl.slice(0, limit).map((entry) => entry.result);
}

function isRemumeItem(input: PharmaSearchResult | RemumeItem | HslDrug): input is RemumeItem {
  return 'norm' in input && 'name' in input;
}

function isSearchResult(input: PharmaSearchResult | RemumeItem | HslDrug): input is PharmaSearchResult {
  return 'source' in input && 'hasHslFicha' in input;
}

/** Formata pré-visualização editável Adulto/Pediatria para injeção no Carrinho PEP. */
export function formatPrescriptionPreview(
  input: PharmaSearchResult | RemumeItem | HslDrug,
  options: PrescriptionPreviewOptions = {},
  hslDrugs?: readonly HslDrug[]
): PrescriptionPreview {
  const profile: PatientProfile = options.profile ?? 'adulto';
  const sourceHsl = hslDrugs ?? cachedHslDrugs ?? [];

  let title = '';
  let naRemume = false;
  let hasHslFicha = false;
  let hslDrug: HslDrug | undefined;
  let defaultPresentation = '';

  if (isSearchResult(input)) {
    title = input.title;
    naRemume = input.naRemume;
    hasHslFicha = input.hasHslFicha;
    hslDrug = input.hslDrug ?? (input.remumeItem ? resolveHslForRemume(input.remumeItem, sourceHsl) : undefined);
    defaultPresentation =
      input.remumeItem?.name ??
      hslDrug?.apresentacoes_remume[0] ??
      hslDrug?.apresentacoes_hsl[0] ??
      input.title;
  } else if (isRemumeItem(input)) {
    title = input.name;
    naRemume = true;
    hasHslFicha = input.hslId !== undefined;
    hslDrug = resolveHslForRemume(input, sourceHsl);
    defaultPresentation = input.name;
  } else {
    title = input.farmaco;
    naRemume = input.na_remume;
    hasHslFicha = true;
    hslDrug = input;
    defaultPresentation = input.apresentacoes_remume[0] ?? input.apresentacoes_hsl[0] ?? input.farmaco;
  }

  const apresentacao = options.selectedPresentation?.trim() || defaultPresentation;
  const notice = hasHslFicha ? null : NO_HSL_FICHA_NOTICE;

  if (!hslDrug) {
    return {
      title,
      profile,
      naRemume,
      hasHslFicha,
      isPlaceholder: true,
      notice: notice ?? 'Ficha HSL ainda não carregada — preencher posologia manualmente.',
      apresentacao,
      posologia: '',
      doseMaxima: '',
      ajusteDose: '',
      administracao: '',
      preparoDiluicao: '',
      contraindicacoes: '',
      gestacaoLactacao: '',
      // Evita vazar instruções internas de UI no texto copiável da prescrição
      editableText: `${apresentacao}\nPosologia: [ ]`,
    };
  }

  const rawPosologia =
    profile === 'pediatria'
      ? hslDrug.dose_pediatria || 'Sem posologia pediátrica específica na ficha HSL — avaliar prescrição manual.'
      : hslDrug.dose_adulto || 'Sem posologia adulto específica na ficha HSL — avaliar prescrição manual.';

  const lines: string[] = [apresentacao];
  const validWeight =
    options.weightKg !== undefined &&
    Number.isFinite(options.weightKg) &&
    options.weightKg >= 0.5 &&
    options.weightKg <= 200;

  if (profile === 'pediatria' && validWeight) {
    lines.push(`Paciente Pediátrico (Peso: ${options.weightKg} kg — conferir cálculo ponderal abaixo)`);
  }
  lines.push(`Posologia (${profile === 'pediatria' ? 'Pediatria' : 'Adulto'}): ${rawPosologia}`);
  if (hslDrug.dose_maxima) {
    lines.push(`Dose máxima: ${hslDrug.dose_maxima}`);
  }
  if (hslDrug.administracao) {
    lines.push(`Administração: ${hslDrug.administracao}`);
  }
  if (hslDrug.ajuste_dose) {
    lines.push(`Ajuste de dose: ${hslDrug.ajuste_dose}`);
  }

  return {
    title,
    profile,
    naRemume,
    hasHslFicha: true,
    isPlaceholder: false,
    notice: null,
    apresentacao,
    posologia: rawPosologia,
    doseMaxima: hslDrug.dose_maxima,
    ajusteDose: hslDrug.ajuste_dose,
    administracao: hslDrug.administracao,
    preparoDiluicao: hslDrug.preparo_diluicao,
    contraindicacoes: hslDrug.contraindicacoes,
    gestacaoLactacao: hslDrug.gestacao_lactacao,
    editableText: lines.join('\n'),
  };
}
