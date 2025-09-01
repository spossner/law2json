import { XMLParser } from 'fast-xml-parser';
import type {
  Footnote
} from '../types/index.ts';

/* ===================== XML Parser Configuration ===================== */

export type PONode =
  | { [tag: string]: any }
  | { '#text': string }
  | { ':text': string }
  | { ':@': Record<string, any> };

export const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  processEntities: true,
  trimValues: false,
  parseAttributeValue: false,
  parseTagValue: false,
});

/* ===================== XML Node Helpers ===================== */

const ATTR_KEY = ':@';
const SKIP_KEYS = new Set([ATTR_KEY, '#text', ':text', '?xml']);
const lnameOf = (raw: string) => raw.replace(/^[^:]*:/, '').toLowerCase();

export function tagKey(n: PONode): string | null {
  if (typeof n !== 'object' || n === null) return null;
  for (const k of Object.keys(n)) {
    if (!SKIP_KEYS.has(k)) return k;
  }
  return null;
}

export function lname(n: PONode): string | null {
  const k = tagKey(n);
  return k ? lnameOf(k) : null;
}

export function childrenOf(n: PONode): PONode[] {
  const k = tagKey(n);
  if (!k) return [];
  const v = (n as any)[k];
  return Array.isArray(v) ? v : [];
}

export function attrsOf(n: PONode): Record<string, any> {
  const kids = childrenOf(n);
  for (const c of kids) if (ATTR_KEY in (c as any)) return (c as any)[ATTR_KEY];
  if (ATTR_KEY in (n as any)) return (n as any)[ATTR_KEY];
  return {};
}

export function isTextNode(n: PONode): boolean {
  return typeof n === 'object' && n !== null && ('#text' in (n as any) || ':text' in (n as any));
}

export function textOf(n: PONode): string {
  const anyN = n as any;
  return anyN['#text'] ?? anyN[':text'] ?? '';
}

export function firstChild(n: PONode, name: string): PONode | undefined {
  const target = name.toLowerCase();
  return childrenOf(n).find(c => lname(c) === target);
}

export function allChildren(n: PONode, name: string): PONode[] {
  const target = name.toLowerCase();
  return childrenOf(n).filter(c => lname(c) === target);
}

export function allDesc(n: PONode, name: string): PONode[] {
  const target = name.toLowerCase();
  const out: PONode[] = [];
  const walk = (x: PONode) => {
    if (lname(x) === target) out.push(x);
    for (const c of childrenOf(x)) walk(c);
  };
  walk(n);
  return out;
}

export function textDeep(n: PONode): string {
  let out = '';
  const walk = (x: PONode) => {
    if (isTextNode(x)) {
      out += textOf(x);
      return;
    }
    for (const c of childrenOf(x)) walk(c);
  };
  walk(n);
  return out.trim();
}

/* ===================== Level Detection ===================== */

export function levelFromCode(code: string): number {
  const s = String(code).trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return 1;
  return Math.ceil(digits.length / 3);
}

/* ===================== Inline → Markdown ===================== */

export function renderInlineToMd(nodes: PONode[]): string {
  let out = '';

  const renderChildren = (arr: PONode[]) => {
    const start = out.length;
    for (const c of arr) walk(c);
    return out.slice(start);
  };

  const walk = (n: PONode) => {
    const t = lname(n);
    if (!t) {
      if (isTextNode(n)) out += textOf(n);
      return;
    }
    const kids = childrenOf(n);

    switch (t) {
      case 'b':
        out += '**' + renderChildren(kids) + '**';
        break;
      case 'i':
        out += '*' + renderChildren(kids) + '*';
        break;
      case 'u':
        out += '<u>' + renderChildren(kids) + '</u>';
        break;
      case 'sup':
        out += '<sup>' + renderChildren(kids) + '</sup>';
        break;
      case 'sub':
        out += '<sub>' + renderChildren(kids) + '</sub>';
        break;
      case 'small':
        out += '<small>' + renderChildren(kids) + '</small>';
        break;
      case 'br':
        out += '<br />';
        break;
      case 'noindex':
        out += renderChildren(kids);
        break;
      case 'fnr': {
        const at = attrsOf(n);
        const id = at.ID ?? at.Id ?? at.id ?? renderChildren(kids);
        if (id) out += `[^${String(id).trim()}]`;
        break;
      }
      default:
        out += renderChildren(kids);
    }
  };

  for (const n of nodes) walk(n);
  return out;
}

/* ===================== Article/Element Parsing Helpers ===================== */

export function parseArticleEnbez(raw: string): { label: string; id: string } | null {
  const s = raw.trim();
  let m = s.match(/^§+\s*([\d]+[a-zA-Z]?)$/);
  if (m) return { label: `§ ${m[1]}`, id: m[1] };
  m = s.match(/^Art(?:\.|ikel)?\s*([\d]+[a-zA-Z]?)$/i);
  if (m) return { label: `Art. ${m[1]}`, id: m[1] };
  return null;
}

export function collectFootnotes(norm: PONode): Footnote[] {
  const out: Footnote[] = [];
  const fns = allDesc(norm, 'footnote');
  for (const fn of fns) {
    const at = attrsOf(fn);
    const rawId = at.ID ?? at.Id ?? at.id ?? '';
    const id = String(rawId).trim();
    if (!id) continue;
    const md = renderInlineToMd(childrenOf(fn)).trim();
    out.push({ id, md });
  }
  return out;
}