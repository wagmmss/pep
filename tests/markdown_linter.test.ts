import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { remark } from 'remark';
import {
  createClinicalSearchIndex,
  searchClinicalProtocols,
  normalizeSearchText,
} from '../src/engine/search.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

const ACTIVE_PROTOCOL_DIRS = [
  '01_Ginecologia_Obstetricia',
  '02_Pronto_Atendimento_UPA',
  '03_Enfermaria_Internacao',
  '04_Pediatria',
  '05_Habilidades_Clinicas',
];

const PEP_DIRS = [
  '01_Ginecologia_Obstetricia',
  '02_Pronto_Atendimento_UPA',
  '03_Enfermaria_Internacao',
  '04_Pediatria',
];

const ENF_EVOLUCAO_FILES = new Set([
  '01_Ginecologia_Obstetricia/01_Enfermaria_Puerperio/02_Puerperio_Evolucao_Diaria.md',
  '01_Ginecologia_Obstetricia/01_Enfermaria_Puerperio/05_Puerperio_Round_Passagem_de_Caso.md',
  '03_Enfermaria_Internacao/02_Evolucao_Diaria_SOAP/01_Evolucao_SOAP_Clinica_Medica.md',
  '03_Enfermaria_Internacao/02_Evolucao_Diaria_SOAP/02_Evolucao_SOAP_Pos_Operatorio.md',
  '03_Enfermaria_Internacao/02_Evolucao_Diaria_SOAP/03_Checklist_Metas_FAST_HUG_BID.md',
  '03_Enfermaria_Internacao/02_Evolucao_Diaria_SOAP/04_Controle_Glicemico_e_Insulinoterapia_Hospitalar.md',
  '03_Enfermaria_Internacao/03_Passagem_de_Plantao_e_Rounds/01_Round_Matinal_e_Passagem_SBAR.md',
]);

function collectMarkdownFiles(dirPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractNodeText(node: any): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (Array.isArray(node.children)) {
    return node.children.map(extractNodeText).join('');
  }
  return '';
}

function walkAst(node: any, visitor: (n: any) => void): void {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkAst(child, visitor);
    }
  }
}

test('Linter AST (remark): todos os protocolos .md ativos possuem H1, headings válidos e zero links quebrados', () => {
  const parser = remark();
  const files = ACTIVE_PROTOCOL_DIRS.flatMap((dir) =>
    collectMarkdownFiles(path.join(ROOT_DIR, dir))
  );

  assert.ok(files.length >= 90, `Esperado >= 90 arquivos .md ativos, encontrado ${files.length}`);

  const issues: string[] = [];

  for (const filePath of files) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const ast = parser.parse(content);

    const headings: Array<{ depth: number; text: string }> = [];
    const emptyLinks: string[] = [];

    walkAst(ast, (node) => {
      if (node.type === 'heading') {
        headings.push({
          depth: node.depth,
          text: extractNodeText(node).trim(),
        });
      }
      if (node.type === 'link') {
        const url = String(node.url || '').trim();
        if (!url || url === '#') {
          emptyLinks.push(extractNodeText(node).trim() || '(sem texto)');
        } else if (!/^(https?:|mailto:|#)/i.test(url)) {
          const targetPath = path.resolve(path.dirname(filePath), url.split('#')[0]);
          if (!fs.existsSync(targetPath)) {
            emptyLinks.push(`${url} (arquivo inexistente)`);
          }
        }
      }
    });

    const h1 = headings.find((h) => h.depth === 1);
    if (!h1 || !h1.text) {
      issues.push(`${relPath}: ausente título H1 (# ...)`);
    }

    const emptyHeading = headings.find((h) => !h.text);
    if (emptyHeading) {
      issues.push(`${relPath}: heading H${emptyHeading.depth} vazio`);
    }

    if (headings.length < 2) {
      issues.push(`${relPath}: estrutura rasa (apenas ${headings.length} heading)`);
    }

    if (emptyLinks.length > 0) {
      issues.push(`${relPath}: links inválidos/quebrados -> ${emptyLinks.join(', ')}`);
    }
  }

  assert.deepEqual(issues, [], `Falhas no linter Markdown (remark):\n${issues.join('\n')}`);
});

test('MiniSearch Engine: busca fuzzy, prefixo, sem acento e preservação de prioridade semântica', () => {
  const sampleItems = [
    {
      title: 'Pneumonia Adquirida na Comunidade (PAC)',
      category: 'Infeccoes e Vias Aereas',
      module_name: 'UPA',
      tags_sintomas: ['tosse', 'febre', 'dispneia'],
      all_triggers: [':pac'],
      symptom_priority: 85,
      pep_body: 'Amoxicilina + Clavulanato ou Azitromicina conforme CURB-65.',
      _title_norm: normalizeSearchText('Pneumonia Adquirida na Comunidade (PAC)'),
      _cat_norm: normalizeSearchText('Infeccoes e Vias Aereas UPA'),
      _triggers_norm: [':pac'],
      _anchor_norm: '',
      _tags_norm: [
        { raw: 'tosse', norm: 'tosse', isDirect: true },
        { raw: 'febre', norm: 'febre', isDirect: true },
        { raw: 'dispneia', norm: 'dispneia', isDirect: true },
      ],
    },
    {
      title: 'Asma Aguda / Crise Asmática',
      category: 'Respiratorio',
      module_name: 'UPA',
      tags_sintomas: ['falta de ar', 'chiado', 'dispneia'],
      all_triggers: [':asma'],
      symptom_priority: 98,
      pep_body: 'Salbutamol spray + Ipratrópio + Prednisolona.',
      _title_norm: normalizeSearchText('Asma Aguda / Crise Asmática'),
      _cat_norm: normalizeSearchText('Respiratorio UPA'),
      _triggers_norm: [':asma'],
      _anchor_norm: '',
      _tags_norm: [
        { raw: 'falta de ar', norm: 'falta de ar', isDirect: true },
        { raw: 'chiado', norm: 'chiado', isDirect: true },
        { raw: 'dispneia', norm: 'dispneia', isDirect: true },
      ],
    },
    {
      title: 'Cetoacidose Diabética (CAD)',
      category: 'Endocrinologia',
      module_name: 'UPA',
      tags_sintomas: ['hiperglicemia', 'acidose'],
      all_triggers: [':cad'],
      symptom_priority: 90,
      pep_body: 'Hidratação vigorosa SF 0,9% + Insulina regular EV + Reposição de K+.',
      _title_norm: normalizeSearchText('Cetoacidose Diabética (CAD)'),
      _cat_norm: normalizeSearchText('Endocrinologia UPA'),
      _triggers_norm: [':cad'],
      _anchor_norm: '',
      _tags_norm: [
        { raw: 'hiperglicemia', norm: 'hiperglicemia', isDirect: true },
        { raw: 'acidose', norm: 'acidose', isDirect: true },
      ],
    },
  ];

  const index = createClinicalSearchIndex(sampleItems);

  // 1. Busca com erro de digitação (fuzzy)
  const typoResults = searchClinicalProtocols(index, sampleItems, 'pneumoia');
  assert.ok(typoResults.length >= 1, 'Deve encontrar Pneumonia mesmo com erro de digitação');
  assert.equal(typoResults[0].item.title, 'Pneumonia Adquirida na Comunidade (PAC)');
  assert.equal(typoResults[0].fuzzyMatched, true);

  // 2. Busca por termo presente apenas no corpo da conduta (pep_body)
  const bodyResults = searchClinicalProtocols(index, sampleItems, 'curb');
  assert.ok(bodyResults.length >= 1, 'Deve encontrar protocolo por termo clínico no pep_body');
  assert.equal(bodyResults[0].item.title, 'Pneumonia Adquirida na Comunidade (PAC)');

  // 3. Prioridade semântica preservada para tags_sintomas diretas
  const symResults = searchClinicalProtocols(index, sampleItems, 'falta de ar');
  assert.equal(symResults[0].item.title, 'Asma Aguda / Crise Asmática');
  assert.equal(symResults[0].isTopHighlight, true);
});

test('Contrato Editorial PEP v3.2: 88 PEPs padronizados, Pediatria unificada, zero colchetes aninhados e Diretrizes em 4 sub-blocos', () => {
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, '04_Pediatria_Puericultura')),
    false,
    'Pasta legada 04_Pediatria_Puericultura deve ter sido unificada em 04_Pediatria/'
  );
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, '04_Pediatria_Pronto_Socorro_e_Puericultura')),
    false,
    'Pasta legada 04_Pediatria_Pronto_Socorro_e_Puericultura deve ter sido unificada em 04_Pediatria/'
  );

  const pepFiles = PEP_DIRS.flatMap((dir) => collectMarkdownFiles(path.join(ROOT_DIR, dir)));
  assert.equal(pepFiles.length, 88, `Esperado exatamente 88 arquivos PEP, encontrado ${pepFiles.length}`);

  const pedFiles = collectMarkdownFiles(path.join(ROOT_DIR, '04_Pediatria'));
  assert.equal(pedFiles.length, 13, `Esperado 13 arquivos em 04_Pediatria/, encontrado ${pedFiles.length}`);

  const primaryTriggers = new Map<string, string>();
  const issues: string[] = [];

  for (const filePath of pepFiles) {
    const rel = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Metadados obrigatórios
    if (!/^\*\*Categoria:\*\*\s+\S+/m.test(content)) issues.push(`${rel}: ausente **Categoria:**`);
    const trigMatch = content.match(/^\*\*Atalho:\*\*\s+([^\n]+)/m);
    if (!trigMatch) {
      issues.push(`${rel}: ausente **Atalho:**`);
    } else {
      const firstTrig = trigMatch[1].split(',')[0].replace(/`/g, '').trim();
      if (!firstTrig.startsWith(';')) {
        issues.push(`${rel}: atalho inválido (${firstTrig})`);
      } else if (primaryTriggers.has(firstTrig)) {
        issues.push(`${rel}: atalho duplicado ${firstTrig} (já usado em ${primaryTriggers.get(firstTrig)})`);
      } else {
        primaryTriggers.set(firstTrig, rel);
      }
    }
    if (!/^\*\*Gravidade:\*\*\s+\S+/m.test(content)) issues.push(`${rel}: ausente **Gravidade:**`);
    if (!/^\*\*CID-10:\*\*\s+\S+/m.test(content)) issues.push(`${rel}: ausente **CID-10:**`);

    // Seções H2 obrigatórias
    if (!/^## 📋 Snippet para Prontuário Eletrônico \(PEP\)$/m.test(content)) {
      issues.push(`${rel}: ausente ## 📋 Snippet para Prontuário Eletrônico (PEP)`);
    }
    if (!/^## 🎯 Diretrizes & Raciocínio Clínico$/m.test(content)) {
      issues.push(`${rel}: ausente ## 🎯 Diretrizes & Raciocínio Clínico`);
    }

    // 4 sub-blocos de Diretrizes
    if (!/^### 🧠 1\. Fisiopatologia & Porquê$/m.test(content)) issues.push(`${rel}: ausente sub-bloco 1 de Diretrizes`);
    if (!/^### 🧭 2\. Critérios & Decisão/m.test(content)) issues.push(`${rel}: ausente sub-bloco 2 de Diretrizes`);
    if (!/^### 💊 3\. Farmacologia & Doses$/m.test(content)) issues.push(`${rel}: ausente sub-bloco 3 de Diretrizes`);
    if (!/^### 🚫 4\. Segurança, Travas & Proibições$/m.test(content)) issues.push(`${rel}: ausente sub-bloco 4 de Diretrizes`);

    // Validação estrita do bloco PEP
    const pepMatch = content.match(/## 📋 Snippet para Prontuário Eletrônico \(PEP\)\n\n```text\n([\s\S]*?)\n```/);
    if (!pepMatch) {
      issues.push(`${rel}: bloco \`\`\`text do PEP não encontrado`);
      continue;
    }
    const pep = pepMatch[1];

    if (pep.includes('**')) issues.push(`${rel}: contém **negrito** dentro do bloco PEP`);
    if (/^#{2,6}\s+.*#{2,6}$/m.test(pep)) issues.push(`${rel}: contém banner ###### dentro do bloco PEP`);
    if (/\b(?:ATENDIDO|EXECUTADO IMEDIATAMENTE)\b/.test(pep)) {
      issues.push(`${rel}: contém afirmação travada (ATENDIDO/EXECUTADO IMEDIATAMENTE)`);
    }
    if (!/# IDENTIFICAÇÃO:/m.test(pep)) issues.push(`${rel}: ausente # IDENTIFICAÇÃO: no PEP`);

    if (rel.startsWith('04_Pediatria/') && !pep.includes('Peso: [ ] kg')) {
      issues.push(`${rel}: Pediatria sem token explícito Peso: [ ] kg`);
    }

    if (ENF_EVOLUCAO_FILES.has(rel)) {
      const idxHist = pep.indexOf('# HISTÓRIA / RESUMO DA INTERNAÇÃO:');
      const idxEvo = pep.search(/^#\s*(?:EVOLUÇÃO|SBAR|METAS|CONTROLE)/im);
      if (idxHist === -1 || (idxEvo !== -1 && idxHist > idxEvo)) {
        issues.push(`${rel}: Evolução Diária sem # HISTÓRIA / RESUMO DA INTERNAÇÃO: antes da evolução`);
      }
    }

    // Prosa corrida em QP, HMA, HISTÓRIA e EVOLUÇÃO (24H): sem bullets, sem Rótulo:, sem parênteses longos
    const pepSections = pep.split(/(?=^#\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/m);
    for (const sec of pepSections) {
      const secLines = sec.split('\n');
      const secTitle = secLines[0].replace(/^#\s+/, '').replace(/:.*/, '').trim().toUpperCase();
      if (
        secTitle === 'QP' ||
        secTitle === 'HMA' ||
        secTitle === 'HISTÓRIA / RESUMO DA INTERNAÇÃO' ||
        secTitle === 'EVOLUÇÃO (24H)'
      ) {
        for (let si = 1; si < secLines.length; si++) {
          const sl = secLines[si];
          if (/^\s*[-*]\s+/.test(sl)) {
            issues.push(`${rel}: bullet em prosa (${secTitle}): ${sl.trim().slice(0, 60)}`);
          }
          if (/^\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9\s/()–-]{5,}:\s*$/.test(sl)) {
            issues.push(`${rel}: subtítulo CAIXA ALTA em prosa (${secTitle}): ${sl.trim()}`);
          }
          const rotuloMatch = sl.match(/^([^\[\n:]{2,65}):\s+\S/);
          if (
            rotuloMatch &&
            !/^(?:CID-10|PA|FC|FR|Tax|SpO2|HGT|EVA|ECG|D\d+)$/i.test(rotuloMatch[1].trim())
          ) {
            issues.push(`${rel}: Rótulo: em prosa (${secTitle}): ${sl.trim().slice(0, 60)}`);
          }
          const parens = sl.matchAll(/\(([^()]+)\)/g);
          for (const pm of parens) {
            const p = pm[1].trim();
            const isPlural = /^(?:s|a|es)$/i.test(p);
            const isObjectiveScoreOrCid = /^(?:EVA|CID-10|Glasgow|Killip|CURB|APGAR|\d|<|>|≥|≤)/i.test(p);
            const isShortUnit = p.length <= 22 && /\b(?:mg|mcg|g|mL|L|kg|mmHg|bpm|irpm|°C|mEq|U\/L|g\/dL|dias?|horas?|min|sem)\b/i.test(p);
            if (!isPlural && !isObjectiveScoreOrCid && !isShortUnit) {
              issues.push(`${rel}: parêntese explicativo em prosa (${secTitle}): (${p.slice(0, 40)})`);
            }
          }
        }
      }
    }

    // Zero ___ nos blocos PEP
    if (pep.includes('___')) {
      issues.push(`${rel}: contém ___ no PEP (usar [ ])`);
    }

    // Pílulas atômicas (<= 55 chars por opção dentro de [...]) e sem corte em preposição/conjunção
    const bracketMatches = pep.matchAll(/\[([^\[\]\n]+)\]/g);
    for (const bm of bracketMatches) {
      let body = bm[1].trim();
      if (body.startsWith('? ') && body.includes('::')) {
        body = body.split('::').slice(1).join('::').trim();
      } else if (body.startsWith('+ ')) {
        body = body.slice(2).trim();
      }
      const opts = body.split(/\s+\/\s+|\s+\|\s+/).map((o) => o.trim().replace(/^\*/, '').trim());
      for (const opt of opts) {
        if (opt.length > 55) {
          issues.push(`${rel}: pílula gigante (${opt.length} chars > 55): [${opt.slice(0, 45)}...]`);
        }
        if (/(?:^|\s)(?:e|de|da|do|das|dos|para|com|em|por|ou|às|a|o|na|no|sem|ao|se)\s*$/i.test(opt)) {
          issues.push(`${rel}: pílula truncada terminando em preposição/artigo: [${opt}]`);
        }
      }
    }

    // Zero clichês verbosos de IA
    if (/\b(?:rigorosamente|franca melhora|evolução favorável)\b/i.test(pep)) {
      issues.push(`${rel}: contém clichê verboso de IA (rigorosamente/franca melhora/evolução favorável)`);
    }

    // Zero colchetes aninhados ou desbalanceados
    const lines = pep.split('\n');
    for (let li = 0; li < lines.length; li++) {
      let depth = 0;
      for (const ch of lines[li]) {
        if (ch === '[') {
          depth++;
          if (depth > 1) {
            issues.push(`${rel}:${li + 1}: colchete aninhado no PEP`);
            break;
          }
        } else if (ch === ']') {
          depth--;
          if (depth < 0) {
            issues.push(`${rel}:${li + 1}: colchete ] sem abertura no PEP`);
            break;
          }
        }
      }
      if (depth > 0) {
        issues.push(`${rel}:${li + 1}: colchete [ não fechado no PEP`);
      }
    }
  }

  assert.deepEqual(issues, [], `Falhas no contrato editorial PEP v3.2:\n${issues.join('\n')}`);
});

test('Contrato Pré-Porta (22 cartões) + Técnica Profunda (20 guias compilados)', () => {
  const habFiles = collectMarkdownFiles(path.join(ROOT_DIR, '05_Habilidades_Clinicas'));
  assert.equal(habFiles.length, 22, `Esperado 22 cartões Pré-Porta, encontrado ${habFiles.length}`);

  const issues: string[] = [];
  for (const filePath of habFiles) {
    const rel = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    const sec7Match = content.match(/^##\s+.*7\.[^\n]*\n([\s\S]*)$/m);
    if (!sec7Match || !sec7Match[1].includes('[CRÍTICO]')) {
      issues.push(`${rel}: Seção 7 sem marcação [CRÍTICO]`);
    }

    const sec5Match = content.match(/^##\s+.*5\.[^\n]*\n+```[^\n]*\n([\s\S]*?)\n```/m);
    if (!sec5Match) {
      issues.push(`${rel}: Seção 5 (Texto Pronto) ausente`);
    } else {
      const sec5 = sec5Match[1];
      const fakeNums = sec5.match(/\[[+-]?\d+(?:[.,]\d+)?\]/g);
      if (fakeNums) {
        issues.push(`${rel}: Seção 5 contém números fictícios pré-preenchidos: ${fakeNums.join(', ')}`);
      }
    }
  }

  const tpPath = path.join(ROOT_DIR, 'src/data/tecnica_profunda.generated.json');
  assert.ok(fs.existsSync(tpPath), 'src/data/tecnica_profunda.generated.json deve existir');
  const tpData = JSON.parse(fs.readFileSync(tpPath, 'utf8'));
  assert.equal(tpData.guideCount, 20, 'Esperado 20 guias profundos compilados');
  assert.equal(tpData.guides.length, 20, 'Esperado array guides com 20 itens');
  const validIds = new Set(tpData.guides.map((g: any) => g.id));
  for (let i = 1; i <= 22; i++) {
    const mapped = tpData.byHabId[`hab-${i}`];
    assert.ok(Array.isArray(mapped) && mapped.length >= 1, `hab-${i} deve mapear para ao menos 1 guia`);
    for (const gid of mapped) {
      assert.ok(validIds.has(gid), `Guia mapeado inválido: ${gid}`);
    }
  }

  assert.deepEqual(issues, [], `Falhas nos cartões Pré-Porta:\n${issues.join('\n')}`);
});
