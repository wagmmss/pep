import glob
import json
import os
import re
import unicodedata

BASE_PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DATA_DIR = os.path.join(BASE_PROJECT, 'src', 'data')
os.makedirs(SRC_DATA_DIR, exist_ok=True)

PED_UNIFIED_DIR = os.path.join(BASE_PROJECT, '04_Pediatria')
PED_LEGACY_DIRS = [
    os.path.join(BASE_PROJECT, '04_Pediatria_Puericultura'),
    os.path.join(BASE_PROJECT, '04_Pediatria_Pronto_Socorro_e_Puericultura'),
]


def resolve_ped_dirs():
    if os.path.isdir(PED_UNIFIED_DIR):
        unified_files = [
            f for f in glob.glob(f"{PED_UNIFIED_DIR}/**/*.md", recursive=True)
            if '_arquivados' not in f and not os.path.basename(f).startswith(('.', '_'))
        ]
        if unified_files:
            return [PED_UNIFIED_DIR]
    return [d for d in PED_LEGACY_DIRS if os.path.isdir(d)]


modules = [
    {
        'id': 'go',
        'name': 'Ginecologia & Obstetrícia',
        'badge': '🌸 GO',
        'dir': os.path.join(BASE_PROJECT, '01_Ginecologia_Obstetricia'),
    },
    {
        'id': 'upa',
        'name': 'Pronto Atendimento / UPA',
        'badge': '🚑 UPA Adulto',
        'dir': os.path.join(BASE_PROJECT, '02_Pronto_Atendimento_UPA'),
    },
    {
        'id': 'enf',
        'name': 'Enfermaria & Internação',
        'badge': '🏥 Enfermaria',
        'dir': os.path.join(BASE_PROJECT, '03_Enfermaria_Internacao'),
    },
    {
        'id': 'ped',
        'name': 'Pediatria & Puericultura',
        'badge': '👶 Pediatria',
        'dir': PED_UNIFIED_DIR,
        'dirs': resolve_ped_dirs(),
    },
]

HAB_DIR = os.path.join(BASE_PROJECT, '05_Habilidades_Clinicas')

CRITICAL_TRIGGERS = {
    ';hpp', ';pre-eclampsia', ';tpp', ';rpmo', ';abortamento', ';dpp-pp', ';violencia-sexual',
    ';dengue', ';abdome-agudo', ';hda', ';sca', ';has-crise', ';asma', ';dpoc', ';eap',
    ';tvp-tep', ';sincope', ';convulsao', ';alergia', ';cad', ';intoxicacao', ';sri',
    ';pcr', ';sepse', ';avc', ';taqui', ';hiperk', ';bradi', ';queimadura',
    ';bva', ';crupe', ';ped-febre', ';convulsao-febril', ';ped-asma', ';ped-exantema',
}


def extract_md_meta(content, labels):
    """Extrai campo de metadados em Markdown no formato **Campo:** valor (mesmo após '|')."""
    if isinstance(labels, str):
        labels = [labels]
    pattern_labels = '|'.join(re.escape(lbl) for lbl in labels)
    m = re.search(
        rf'(?:^|\|\s*)\*\*(?:{pattern_labels})\s*:?\*\*\s*:?\s*([^|\n\r]+)',
        content,
        re.MULTILINE | re.IGNORECASE,
    )
    return m.group(1).strip().strip('`').strip() if m else ''


def normalize_gravidade(raw_grav, trigger, category, mod_id):
    val = (raw_grav or '').lower()
    if any(k in val for k in ('crític', 'critic', 'vermelh', 'emerg')):
        return 'critico'
    if any(k in val for k in ('urgent', 'amarel', 'moderad')):
        return 'urgente'
    if any(k in val for k in ('rotina', 'ambulat', 'verde', 'azul', 'eletiv')):
        return 'rotina'
    if mod_id == 'hab':
        return 'tecnica'

    trig = (trigger or '').strip().lower()
    cat = (category or '')
    if trig in CRITICAL_TRIGGERS or any(k in cat for k in ('Emergencias GO', 'Emergência', 'Sala Vermelha')):
        return 'critico'
    if mod_id in ('upa', 'ped') or 'Centro Obstetrico' in cat:
        if 'Triagem' in cat or 'Puericultura' in cat:
            return 'rotina'
        return 'urgente'
    return 'rotina'


def extract_section_body(content, heading_pattern):
    """Extrai o conteúdo de uma seção H2 (## ...) até a próxima H2 ou fim do arquivo."""
    m = re.search(
        rf'^##\s+{heading_pattern}[^\n]*\n(.*?)(?=^##\s+|\Z)',
        content,
        re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    body = m.group(1).strip() if m else ''
    return re.sub(r'\n+---\s*$', '', body).strip()


def _norm_dedup_key(text: str) -> str:
    nfkd = unicodedata.normalize('NFKD', text or '')
    no_accents = ''.join(ch for ch in nfkd if not unicodedata.combining(ch))
    cleaned = re.sub(r'[^a-z0-9 ]+', ' ', no_accents.lower())
    return re.sub(r'\s+', ' ', cleaned).strip()


def _parse_bullet_items(section_text, default_title='Armadilha Crítica'):
    items = []
    for raw_line in (section_text or '').splitlines():
        line = raw_line.strip()
        if not line or line == '---':
            continue
        bold_match = re.match(r'^(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*\s*(.*)$', line)
        if bold_match:
            p_title = bold_match.group(1).strip().rstrip(':').strip()
            p_detail = bold_match.group(2).lstrip(':').strip()
            items.append({'title': p_title, 'detail': p_detail})
            continue
        plain_match = re.match(r'^(?:[-*]|\d+\.)\s+(.+)$', line)
        if plain_match:
            txt = plain_match.group(1).strip()
            if ':' in txt:
                p_title, p_detail = txt.split(':', 1)
                items.append({'title': p_title.strip(), 'detail': p_detail.strip()})
            else:
                items.append({'title': default_title, 'detail': txt})
    return items


def _classify_pep_section_key(header_line):
    h = header_line.upper().strip()
    h = re.sub(r'^#+\s*', '', h)
    h = re.sub(r'^>>\s*', '', h)
    h = re.sub(r'^\d+\.\s*', '', h)

    if h.startswith('IDENTIFICA'):
        return 'identificacao'
    if h.startswith('QP'):
        return 'qp'
    if h.startswith('HMA'):
        return 'hma'
    if h.startswith('HISTÓRIA / RESUMO') or h.startswith('HISTORIA / RESUMO') or 'RESUMO DA INTERNA' in h:
        return 'historia_internacao'
    if h.startswith('EVOLUÇÃO') or h.startswith('EVOLUCAO'):
        return 'evolucao_24h'
    if h.startswith('INDICAÇÃO') or h.startswith('INDICACAO'):
        return 'indicacao'
    if h.startswith('DESCRIÇÃO TÉCNICA') or h.startswith('DESCRICAO TECNICA'):
        return 'descricao_tecnica'
    if h.startswith('EXAME FÍSICO') or h.startswith('EXAME FISICO'):
        return 'exame_fisico'
    if h.startswith('EXAMES'):
        return 'exames'
    if h.startswith('HIPÓTESES') or h.startswith('HIPOTESES') or h.startswith('AVALIAÇÃO') or h.startswith('AVALIACAO'):
        return 'hipoteses'
    if h.startswith('CONDUTA') or h.startswith('PLANO'):
        return 'conduta'
    if h.startswith('RECEITA') or h.startswith('PRESCRIÇÃO DOMICILIAR') or h.startswith('PRESCRICAO DOMICILIAR') or h.startswith('PRESCRIÇÃO DE ALTA') or h.startswith('PRESCRICAO DE ALTA'):
        return 'receita'
    if h.startswith('ORIENTAÇÕES') or h.startswith('ORIENTACOES') or h.startswith('SINAIS DE ALARME'):
        return 'orientacoes'
    if h.startswith('CUIDADOS PÓS') or h.startswith('CUIDADOS POS'):
        return 'cuidados_pos'
    return None


def extract_pep_sections(snippet_pep):
    """Segmenta o snippet PEP em blocos nomeados para consumo estruturado pela UI e Power Actions."""
    sections = {}
    current_key = None
    buf = []

    section_header_re = re.compile(
        r'^(?:#+\s*|>>\s*)?(?:\d+\.\s*)?(IDENTIFICAÇÃO|IDENTIFICACAO|QP|HMA|HISTÓRIA\s*/\s*RESUMO[^\n:]*|HISTORIA\s*/\s*RESUMO[^\n:]*|EVOLUÇÃO(?:\s*\(24H\))?|EVOLUCAO(?:\s*\(24H\))?|INDICAÇÃO|INDICACAO|DESCRIÇÃO TÉCNICA|DESCRICAO TECNICA|EXAME FÍSICO|EXAME FISICO|EXAMES|HIPÓTESES DIAGNÓSTICAS|HIPOTESES DIAGNOSTICAS|AVALIAÇÃO(?:\s*&\s*PLANO)?|CONDUTA|PLANO(?:\s*/\s*CONDUTA|\s+TERAPÊUTICO)?|RECEITA|PRESCRIÇÃO DOMICILIAR[^\n:]*|PRESCRIÇÃO DE ALTA[^\n:]*|ORIENTAÇÕES[^\n:]*|ORIENTACOES[^\n:]*|SINAIS DE ALARME[^\n:]*|CUIDADOS PÓS-PROCEDIMENTO)\s*:',
        re.IGNORECASE,
    )

    for raw_line in (snippet_pep or '').splitlines():
        m = section_header_re.match(raw_line.strip())
        if m:
            if current_key and buf:
                sections[current_key] = '\n'.join(buf).strip()
            key = _classify_pep_section_key(m.group(1))
            current_key = key
            buf = [raw_line]
        elif current_key is not None:
            buf.append(raw_line)

    if current_key and buf:
        sections[current_key] = '\n'.join(buf).strip()

    return sections


def parse_hab_card(file_path, seq_num):
    """Faz o parsing completo de um cartão de habilidade clínica em 05_Habilidades_Clinicas/."""
    with open(file_path, 'r', encoding='utf-8') as fh:
        content = fh.read()

    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else os.path.splitext(os.path.basename(file_path))[0]

    raw_trig = extract_md_meta(content, ['Atalho Rápido', 'Atalho'])
    all_triggers = [t.strip().strip('`') for t in re.split(r',', raw_trig) if t.strip()] if raw_trig else []
    trigger = all_triggers[0] if all_triggers else f';hab-{seq_num}'
    if not all_triggers:
        all_triggers = [trigger]

    hab_category = extract_md_meta(content, ['Categoria', 'Área']) or 'Habilidades Clínicas'
    time_goal = extract_md_meta(content, ['Meta de Tempo', 'Tempo Alvo de Revisão Pré-Porta', 'Tempo Alvo', 'Tempo']) or '30s Pré-Porta'
    anchor = extract_md_meta(content, ['Âncora', 'Ancora'])

    sec5 = extract_section_body(content, r'(?:📝\s*)?5\.\s*COMO REGISTRAR NO PRONTUÁRIO')
    sec5_code = re.search(r'```(?:text|markdown|md)?\s*\n(.*?)\n```', sec5, re.DOTALL)
    sec5_clean = sec5_code.group(1).strip() if sec5_code else sec5.strip()

    legacy_pre = extract_section_body(content, r'(?:⚡\s*)?Pr[eé]-Porta(?:\s*30s)?')
    if legacy_pre:
        pre_block = re.search(r'```(?:text|markdown|md)?\s*\n(.*?)\n```', legacy_pre, re.DOTALL)
        pre_porta = pre_block.group(1).strip() if pre_block else legacy_pre.strip()
    else:
        sec1 = extract_section_body(content, r'(?:🎯\s*)?1\.\s*O QUE NÃO ESQUECER')
        sec2 = extract_section_body(content, r'(?:🧠\s*)?2\.\s*MNEMÔNICO')
        sec3 = extract_section_body(content, r'(?:🛠️\s*)?3\.\s*COREOGRAFIA')

        if not anchor and sec2:
            anchor = re.sub(r'^>\s*', '', sec2.splitlines()[0]).strip().strip('*')

        parts = []
        if sec1:
            parts.append(f"1. O QUE NÃO ESQUECER (Visão 5s):\n{sec1}")
        if sec2:
            clean_s2 = re.sub(r'^>\s?', '', sec2, flags=re.M).strip()
            s2_non_empty_lines = [ln.strip() for ln in clean_s2.splitlines() if ln.strip()]
            has_rich_s2 = len(s2_non_empty_lines) > 1 or (
                bool(clean_s2) and _norm_dedup_key(clean_s2) != _norm_dedup_key(anchor)
            )
            if has_rich_s2:
                parts.append(f"2. MNEMÔNICO / REGRA DE OURO:\n{clean_s2}")
        if sec3:
            parts.append(f"3. COREOGRAFIA / PASSO A PASSO TÉCNICO:\n{sec3}")
        pre_porta = '\n\n'.join(parts).strip()

    chk_section = extract_section_body(content, r'(?:✅\s*)?(?:\d+\.\s*)?Checklist(?:\s+P[oó]s-Atendimento)?')
    checklist_sections = []
    current_sec = None

    for raw_line in chk_section.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        sec_match = re.match(r'^###\s+(.+)$', line)
        if sec_match:
            current_sec = {
                'title': sec_match.group(1).strip(),
                'items': [],
            }
            checklist_sections.append(current_sec)
            continue

        item_match = re.match(r'^[-*]\s+\[\s*[xX ]?\s*\]\s+(.+)$', line)
        if item_match:
            if current_sec is None:
                current_sec = {'title': 'Checklist Geral', 'items': []}
                checklist_sections.append(current_sec)
            sec_idx = len(checklist_sections) - 1
            item_idx = len(current_sec['items'])
            item_text = item_match.group(1).strip()
            is_critical = bool(re.search(r'\[CR[IÍ]TICO\]', item_text, re.IGNORECASE))
            current_sec['items'].append({
                'id': f'{sec_idx}-{item_idx}',
                'text': item_text,
                'critical': is_critical,
            })

    checklist_sections = [s for s in checklist_sections if s['items']]
    checklist_total = sum(len(s['items']) for s in checklist_sections)

    rf_section = extract_section_body(content, r'(?:[^\w\s]+\s*)?(?:\d+\.\s*)?RED FLAGS')
    pit_section = extract_section_body(content, r'(?:[^\w\s]+\s*)?(?:\d+\.\s*)?Armadilhas(?:\s+(?:DO\s+INTERNO|&\s*Erros(?:\s+Fatais)?))?')
    raw_pitfalls = _parse_bullet_items(rf_section, 'Red Flag') + _parse_bullet_items(pit_section, 'Erro Crítico')
    pitfalls = []
    seen_pitfalls = set()
    for pf in raw_pitfalls:
        dedup_key = _norm_dedup_key(pf.get('title', '')) or _norm_dedup_key(pf.get('detail', ''))
        if dedup_key and dedup_key in seen_pitfalls:
            continue
        if dedup_key:
            seen_pitfalls.add(dedup_key)
        pitfalls.append(pf)

    rel_path = os.path.relpath(file_path, BASE_PROJECT)

    return {
        'id': f'hab-{seq_num}',
        'mod_id': 'hab',
        'module_name': 'Habilidades Clínicas',
        'badge': '🧠 Habilidades',
        'title': title,
        'trigger': trigger,
        'all_triggers': all_triggers,
        'category': hab_category,
        'hab_category': hab_category,
        'gravidade': 'tecnica',
        'cid10': '',
        'time_goal': time_goal,
        'anchor': anchor,
        'pre_porta': pre_porta,
        'checklist_sections': checklist_sections,
        'checklist_total': checklist_total,
        'pitfalls': pitfalls,
        'pitfalls_raw': '\n\n'.join(p for p in [rf_section, pit_section] if p).strip(),
        'path': rel_path,
        'pep_body': sec5_clean,
        'has_split': False,
        'evolucao_body': '',
        'conduta_body': '',
        'has_receita': False,
        'receita_body': '',
        'receita_meds_body': '',
        'orientacoes_body': '',
        'has_guia': False,
        'guia_body': '',
        'sections': {'Texto Pronto': sec5_clean} if sec5_clean else {},
    }


def _split_top_level_choices_py(inner: str) -> list:
    trimmed = inner.strip()
    if trimmed.startswith('+ '):
        trimmed = trimmed[2:].strip()
    parts = []
    b_depth = 0
    p_depth = 0
    cur_start = 0
    n = len(trimmed)
    i = 0
    while i < n:
        ch = trimmed[i]
        if ch == '[':
            b_depth += 1
        elif ch == ']' and b_depth > 0:
            b_depth -= 1
        elif ch == '(':
            p_depth += 1
        elif ch == ')' and p_depth > 0:
            p_depth -= 1
        if b_depth == 0 and p_depth == 0:
            if trimmed[i:i + 3] in (' / ', ' | '):
                parts.append(trimmed[cur_start:i].strip())
                cur_start = i + 3
                i += 3
                continue
        i += 1
    parts.append(trimmed[cur_start:].strip())
    return [p for p in parts if p]


def _format_multi_choices_py(selected: list) -> str:
    clean = [s.strip() for s in selected if s and s.strip()]
    if not clean:
        return ''
    if len(clean) == 1:
        return clean[0]
    if len(clean) == 2:
        return f"{clean[0]} e {clean[1]}"
    return f"{', '.join(clean[:-1])} e {clean[-1]}"


def clean_pep_for_static_export(text: str) -> str:
    """Resolve defaults [*...] e remove marcadores de UI ([? ...], [+ ...]) e **negrito**."""
    cleaned_md = re.sub(r'\*\*([^*]+)\*\*', r'\1', text or '')
    out_lines = []
    for raw_line in cleaned_md.splitlines():
        i = 0
        n = len(raw_line)
        buf = []
        while i < n:
            if raw_line[i] == '[':
                depth = 1
                j = i + 1
                while j < n and depth > 0:
                    if raw_line[j] == '[':
                        depth += 1
                    elif raw_line[j] == ']':
                        depth -= 1
                    j += 1
                if depth == 0:
                    inner = raw_line[i + 1:j - 1]
                    trimmed = inner.strip()
                    if re.match(r'^\?\s*[^:]+::', trimmed):
                        i = j
                        continue
                    opts = _split_top_level_choices_py(trimmed)
                    if len(opts) >= 2:
                        defaults = [o[1:].strip() for o in opts if o.startswith('*') and not o.startswith('**')]
                        if defaults:
                            buf.append(_format_multi_choices_py(defaults))
                        elif trimmed.startswith('+ '):
                            buf.append(f"[{trimmed[2:].strip()}]")
                        else:
                            buf.append(raw_line[i:j])
                    else:
                        buf.append(raw_line[i:j])
                    i = j
                    continue
            buf.append(raw_line[i])
            i += 1
        line_str = ''.join(buf)
        line_str = re.sub(r'\s{2,}(?!--)', ' ', line_str).rstrip()
        out_lines.append(line_str)
    return '\n'.join(out_lines)


def build_all():
    pep_snippets = []
    seen_paths = set()

    for mod in modules:
        mod_dirs = mod.get('dirs') or [mod['dir']]
        mod_files = []
        for mdir in mod_dirs:
            if os.path.isdir(mdir):
                for f in sorted(glob.glob(f"{mdir}/**/*.md", recursive=True)):
                    if '_arquivados' in f or os.path.basename(f).startswith(('.', '_')):
                        continue
                    if f not in seen_paths:
                        seen_paths.add(f)
                        mod_files.append(f)

        print(f"Processando {mod['name']}: {len(mod_files)} arquivos.")

        for f in mod_files:
            with open(f, 'r', encoding='utf-8') as fh:
                content = fh.read()

            title_match = re.search(r'^#\s+(.+)$', content, re.M)
            title = (
                title_match.group(1)
                .replace('Protocolo de Atendimento:', '')
                .replace('Protocolo:', '')
                .strip()
                if title_match
                else os.path.basename(f)
            )

            trigger_match = re.search(
                r'\*\*Atalhos?(?:\s+(?:Recomendados?|sugeridos?))?\s*:?\*\*\s*:?\s*([^\n\r]+)',
                content,
                re.IGNORECASE,
            )
            if trigger_match:
                raw_line = trigger_match.group(1).strip()
                raw_triggers = re.split(r'\s*\|\s*\*\*', raw_line)[0].strip()
                parsed_trigs = [
                    t.strip().strip('`').strip()
                    for t in re.split(r'\||,', raw_triggers)
                    if t.strip().strip('`').strip()
                ]
                if parsed_trigs:
                    trigger = parsed_trigs[0]
                    all_triggers = parsed_trigs
                else:
                    trigger = ';' + os.path.splitext(os.path.basename(f))[0].lower().replace('_', '-')
                    all_triggers = [trigger]
            else:
                trigger = ';' + os.path.splitext(os.path.basename(f))[0].lower().replace('_', '-')
                all_triggers = [trigger]

            raw_cat_meta = extract_md_meta(content, ['Categoria', 'Área'])
            raw_grav_meta = extract_md_meta(content, ['Gravidade', 'Prioridade', 'Risco'])
            cid10_meta = extract_md_meta(content, ['CID-10', 'CID10', 'CID'])

            pep_match = re.search(
                r'##\s+(?:📋\s*)?Snippet[^\n]*\n+```(?:markdown|text|txt)?\n(.*?)\n```',
                content,
                re.DOTALL | re.IGNORECASE,
            )
            if pep_match:
                snippet_pep = pep_match.group(1).strip()
            else:
                first_block = re.search(r'```(?:markdown|text|txt)?\n(.*?)\n```', content, re.DOTALL)
                snippet_pep = first_block.group(1).strip() if first_block else content.strip()

            split_match = re.search(
                r'^(?:(?:#+\s*|>>\s*)?(?:\d+\.\s*)?(?:PLANO\s*/\s*CONDUTA|PLANO\s+TERAPÊUTICO|PLANO|CONDUTA|PRESCRIÇÃO(?:\s*MÉDICA)?|CUIDADOS PÓS-PROCEDIMENTO)\s*:?.*)$',
                snippet_pep,
                re.M | re.IGNORECASE,
            )
            if split_match:
                split_pos = split_match.start()
                evolucao_body = snippet_pep[:split_pos].strip()
                conduta_body = snippet_pep[split_pos:].strip()
                has_split = True
            else:
                evolucao_body = snippet_pep
                conduta_body = ''
                has_split = False

            receita_match = re.search(
                r'##\s+💊\s*Receita[^\n]*\n+(?:>[^\n]*\n+)*```(?:markdown|text|txt)?\n(.*?)\n```',
                content,
                re.DOTALL,
            )
            if receita_match:
                receita_text = receita_match.group(1).strip()
            else:
                rec_inline = re.search(
                    r'^(?:>>\s*|#+\s*)?(?:RECEITA|PRESCRIÇÃO DOMICILIAR(?:\s*/\s*(?:DE\s+)?ALTA|\s*/\s*RECEITA DE ALTA)?|PRESCRIÇÃO DE ALTA(?:\s*&\s*ORIENTAÇÕES[^\n]*)?|RECEITA DE ALTA|RECEITA MÉDICA)\s*:?[^\n]*\n([\s\S]+)$',
                    snippet_pep,
                    re.M | re.I,
                )
                receita_text = rec_inline.group(1).strip() if rec_inline else ''

            ori_match = re.search(
                r'^((?:>>\s*|#+\s*)?(?:ORIENTAÇÕES(?:\s*/\s*SINAIS DE ALARME|\s+DE\s+ALTA)?|SINAIS DE ALARME)\s*:?[^\n]*\n[\s\S]+)$',
                snippet_pep,
                re.M | re.I,
            )
            orientacoes_text = ori_match.group(1).strip() if ori_match else ''

            if receita_text:
                rec_ori_inline = re.search(
                    r'^((?:>>\s*|#+\s*)?(?:ORIENTAÇÕES|SINAIS DE ALARME)[^\n]*\n[\s\S]*)$',
                    receita_text,
                    re.M | re.I,
                )
                receita_meds_text = (
                    receita_text[:rec_ori_inline.start()].strip()
                    if rec_ori_inline
                    else receita_text
                )
            else:
                receita_meds_text = ''

            guia_match = re.search(
                r'(?:##\s+(?:🎯\s*)?(?:Diretrizes[^\n]*|Guia de Bolso[^\n]*)\n+|###\s+\[(?:REGRAS DE CONDUTA|DIRETRIZES|PONTOS CRÍTICOS)[^\]]*\]\s*\n*)(.*)',
                content,
                re.DOTALL | re.IGNORECASE,
            )
            guia_text = guia_match.group(1).strip() if guia_match else ''

            rel_path = os.path.relpath(f, BASE_PROJECT)
            subcat = os.path.basename(os.path.dirname(f)).replace('_', ' ')
            subcat_clean = re.sub(r'^\d+\s*', '', subcat)
            if raw_cat_meta and subcat_clean.lower() in ('pediatria', '04 pediatria'):
                subcat_clean = raw_cat_meta

            gravidade = normalize_gravidade(raw_grav_meta, trigger, subcat_clean, mod['id'])
            sections = extract_pep_sections(snippet_pep)

            item = {
                'id': f"{mod['id']}-{len(pep_snippets)+1}",
                'mod_id': mod['id'],
                'module_name': mod['name'],
                'badge': mod['badge'],
                'title': title,
                'trigger': trigger,
                'all_triggers': all_triggers,
                'category': subcat_clean,
                'gravidade': gravidade,
                'cid10': cid10_meta,
                'path': rel_path,
                'pep_body': snippet_pep,
                'has_split': has_split,
                'evolucao_body': evolucao_body,
                'conduta_body': conduta_body,
                'has_receita': bool(receita_text),
                'receita_body': receita_text,
                'receita_meds_body': receita_meds_text,
                'orientacoes_body': orientacoes_text,
                'has_guia': bool(guia_text),
                'guia_body': guia_text,
                'sections': sections,
            }
            pep_snippets.append(item)

    print(f"\nTotal de snippets PEP compilados: {len(pep_snippets)}")

    hab_files = sorted(glob.glob(f"{HAB_DIR}/**/*.md", recursive=True)) if os.path.isdir(HAB_DIR) else []
    hab_snippets = [parse_hab_card(f, i + 1) for i, f in enumerate(hab_files)]
    print(f"Processando Habilidades Clínicas: {len(hab_snippets)} cartões.")

    cockpit_items = pep_snippets + hab_snippets
    count_by_mod = {m['id']: len([s for s in pep_snippets if s['mod_id'] == m['id']]) for m in modules}
    protocols_payload = {
        'version': 2,
        'counts': {
            'total': len(cockpit_items),
            'pep': len(pep_snippets),
            'hab': len(hab_snippets),
            'go': count_by_mod.get('go', 0),
            'upa': count_by_mod.get('upa', 0),
            'enf': count_by_mod.get('enf', 0),
            'ped': count_by_mod.get('ped', 0),
        },
        'items': cockpit_items,
    }
    protocols_json_path = os.path.join(SRC_DATA_DIR, 'protocols.generated.json')
    with open(protocols_json_path, 'w', encoding='utf-8') as fh:
        json.dump(protocols_payload, fh, indent=2, ensure_ascii=False)

    print(f"Protocolos compilados com sucesso em {protocols_json_path}!")


if __name__ == '__main__':
    build_all()
