import type {
  DocumentNode,
  StructureNode,
  ElementNode,
} from '../types/index.ts';

import {
  parser,
  type PONode,
  firstChild,
  textDeep,
  attrsOf,
  allDesc,
  childrenOf,
  lname,
  levelFromCode,
  parseArticleEnbez,
  collectFootnotes
} from './converter-utils.ts';

import { defaultParserRegistry } from './parsers/index.ts';

/* ===================== Main Parsing Functions ===================== */

function parseElement(norm: PONode): ElementNode | null {
  const meta = firstChild(norm, 'metadaten');
  if (!meta) return null;

  const enbezN = firstChild(meta, 'enbez');
  if (!enbezN) return null;

  const enbez = textDeep(enbezN).trim();
  const titleN = firstChild(meta, 'titel');
  const title = titleN ? textDeep(titleN) : undefined;
  const doknr = attrsOf(norm).doknr;

  // Check if this is a traditional article (§ or Art.) for label formatting
  const articleParsed = parseArticleEnbez(enbez);
  const label = articleParsed ? articleParsed.label : enbez;
  const id = articleParsed ? articleParsed.id : enbez;

  const element: ElementNode = {
    type: 'element',
    id,
    label,
    title,
    ...(doknr ? { doknr } : {}),
    children: [],
  };

  const contents = allDesc(norm, 'content');
  for (const contentEl of contents) {
    for (const child of childrenOf(contentEl)) {
      const t = lname(child);
      if (!t) continue;
      
      // Use parser registry to handle different element types
      const parsedChild = defaultParserRegistry.parse(t, child, id);
      if (parsedChild) {
        element.children.push(parsedChild as any);
      }
    }
  }

  const fnotes = collectFootnotes(norm);
  if (fnotes.length) element.footnotes = fnotes;

  return element;
}

/* ===================== Structure Parsing ===================== */

type StructureParse = { node: StructureNode; level: number };

function parseStructure(norm: PONode): StructureParse | null {
  const meta = firstChild(norm, 'metadaten');
  if (!meta) return null;
  const gl = firstChild(meta, 'gliederungseinheit');
  if (!gl) return null;

  const codeN = firstChild(gl, 'gliederungskennzahl');
  const labelN = firstChild(gl, 'gliederungsbez');
  const titleN = firstChild(gl, 'gliederungstitel');

  const id = codeN ? textDeep(codeN) : '';
  const label = labelN ? textDeep(labelN) : '';
  const title = titleN ? textDeep(titleN) : undefined;

  if (!id || !label) return null;

  const level = levelFromCode(id);
  const node: StructureNode = {
    type: 'structure',
    id,
    label,
    ...(title ? { title } : {}),
    children: [],
  };
  return { node, level };
}

/* ===================== Document Metadata ===================== */

function extractLawMetadata(norm: PONode, doc: DocumentNode): void {
  const meta = firstChild(norm, 'metadaten');
  if (!meta) return;

  // Extract abbreviation (jurabk)
  if (!doc.jurabk) {
    const j = firstChild(meta, 'jurabk');
    if (j) {
      const jurabk = textDeep(j).trim();
      // Clean up format like "BNatSchG 2009" -> "BNatSchG"
      doc.jurabk = jurabk.replace(/\s+\d{4}$/, '');
    }
  }

  // Extract title - try multiple sources
  if (!doc.title) {
    // Try long title first (langue)
    const lange = firstChild(meta, 'langue');
    if (lange) {
      doc.title = textDeep(lange).trim();
    } else {
      // Try short title (kurzue)
      const kurz = firstChild(meta, 'kurzue');
      if (kurz) {
        doc.title = textDeep(kurz).trim();
      } else {
        // Fallback to artikel title
        const titel = firstChild(meta, 'titel');
        if (titel) {
          doc.title = textDeep(titel).trim();
        }
      }
    }
  }
}

/* ===================== Norm Collection ===================== */

function collectNorms(root: PONode[]): PONode[] {
  const out: PONode[] = [];
  const visit = (n: PONode) => {
    if (lname(n) === 'norm') out.push(n);
    for (const c of childrenOf(n)) visit(c);
  };
  for (const n of root) visit(n);
  return out;
}

/* ===================== Main Conversion ===================== */

function convert(xml: string): DocumentNode {
  const po = parser.parse(xml) as PONode[];
  const norms = collectNorms(po);

  const doc: DocumentNode = { type: 'document', children: [] };
  const stack: StructureNode[] = [];

  // Extract law metadata early from the first applicable norm
  for (const norm of norms) {
    extractLawMetadata(norm, doc);
    if (doc.jurabk && doc.title) break; // Stop once we have both
  }

  const pushInto = (node: StructureNode | ElementNode) => {
    if (stack.length) stack[stack.length - 1].children.push(node as any);
    else doc.children.push(node as any);
  };

  for (const norm of norms) {
    const parsedStructure = parseStructure(norm);
    if (parsedStructure) {
      const { node, level } = parsedStructure;
      while (stack.length >= level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else doc.children.push(node);
      stack.push(node);

      // set doc.jurabk/title once (best-effort)
      extractLawMetadata(norm, doc);
      continue;
    }

    const element = parseElement(norm);
    if (element) {
      extractLawMetadata(norm, doc);
      pushInto(element);
      continue;
    }

    // ignore other norm variants
  }

  return doc;
}

export { convert };