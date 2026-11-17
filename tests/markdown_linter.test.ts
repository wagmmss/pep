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
  '04_Pediatria_Puericultura',
  '05_Habilidades_Clinicas',
];

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
