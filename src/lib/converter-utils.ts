import { XMLParser } from 'fast-xml-parser';

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
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
});

/* ===================== XML Node Helpers ===================== */

const ATTR_KEY = ':@';
const SKIP_KEYS = new Set([ATTR_KEY, '#text', ':text', '?xml']);
const lnameOf = (raw: string) => raw.replace(/^[^:]*:/, '').toLowerCase();

function tagKey(n: PONode): string | null {
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
  const s = code.trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return 1;
  return Math.ceil(digits.length / 3);
}
