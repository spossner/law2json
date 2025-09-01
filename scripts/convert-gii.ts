#!/usr/bin/env ts-node

import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

/* ===================== Types (agreed schema) ===================== */

export interface DocumentNode {
  type: "document";
  jurabk?: string;
  title?: string;
  children: Node[];
}

export interface OutlineNode {
  type: "outline";
  id: string;        // gliederungskennzahl
  label: string;     // gliederungsbez
  title?: string;    // gliederungstitel
  level: number;     // computed from id
  children: Node[];
}

export interface ArticleNode {
  type: "article";
  id: string;        // pure number (e.g., "14")
  label: "§" | "Art.";
  title?: string;
  doknr?: string;
  footnotes?: Footnote[];
  children: Node[];
}

export interface SectionNode {
  type: "section";  // e.g., Inhaltsübersicht, Vorbemerkung, etc.
  title?: string;   // usually the enbez
  doknr?: string;
  children: Node[]; // paragraphs, lists, tables (like an article, but no §/Art.)
}

export interface ParagraphNode {
  type: "p";
  label?: "Abs.";
  id?: string;       // "1", "2", ...
  children: Array<TextRun | ListNode>;
}

export interface TextRun {
  type: "md";
  md: string;        // Markdown (+ tiny HTML: u/small/sup/sub/br)
}

export type ListKind = "ordered" | "unordered";
export type ListStyle =
  | "arabic" | "roman-lower" | "roman-upper"
  | "alpha-lower" | "alpha-upper"
  | "bullet" | "dash" | "custom";

export interface ListNode {
  type: "list";
  kind: ListKind;
  style: ListStyle;
  symbol?: string;           // for unordered + custom
  children: ListItemNode[];
}

export interface ListItemNode {
  type: "li";
  marker?: string;           // ordered only
  children: Array<TextRun | ParagraphNode | ListNode>;
}

export interface TableNode {
  type: "table";
  rows: string[][];          // rows of Markdown cells
}

export interface Footnote {
  id: string;                // referenced by [^id]
  md: string;                // Markdown + tiny HTML
}

export type Node =
  | OutlineNode | ArticleNode | SectionNode
  | ParagraphNode | ListNode | ListItemNode
  | TableNode | TextRun;

/* ===================== Fast-XML-Parser (preserve order) ===================== */

type PONode =
  | { [tag: string]: any }
  | { "#text": string }
  | { ":text": string }
  | { ":@": Record<string, any> };

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  processEntities: true,
  trimValues: false,
});

/* ===================== Helpers (namespace/case/text robust) ===================== */

const ATTR_KEY = ":@";
const SKIP_KEYS = new Set([ATTR_KEY, "#text", ":text", "?xml"]);
const lnameOf = (raw: string) => raw.replace(/^[^:]*:/, "").toLowerCase();

function tagKey(n: PONode): string | null {
  if (typeof n !== "object" || n === null) return null;
  for (const k of Object.keys(n)) {
    if (!SKIP_KEYS.has(k)) return k;
  }
  return null;
}
function lname(n: PONode): string | null {
  const k = tagKey(n);
  return k ? lnameOf(k) : null;
}
function childrenOf(n: PONode): PONode[] {
  const k = tagKey(n);
  if (!k) return [];
  const v = (n as any)[k];
  return Array.isArray(v) ? v : [];
}
function attrsOf(n: PONode): Record<string, any> {
  const kids = childrenOf(n);
  for (const c of kids) if (ATTR_KEY in (c as any)) return (c as any)[ATTR_KEY];
  if (ATTR_KEY in (n as any)) return (n as any)[ATTR_KEY];
  return {};
}
function isTextNode(n: PONode): boolean {
  return typeof n === "object" && n !== null && (("#text" in (n as any)) || (":text" in (n as any)));
}
function textOf(n: PONode): string {
  const anyN = n as any;
  return (anyN["#text"] ?? anyN[":text"] ?? "");
}
function firstChild(n: PONode, name: string): PONode | undefined {
  const target = name.toLowerCase();
  return childrenOf(n).find((c) => lname(c) === target);
}
function allChildren(n: PONode, name: string): PONode[] {
  const target = name.toLowerCase();
  return childrenOf(n).filter((c) => lname(c) === target);
}
function allDesc(n: PONode, name: string): PONode[] {
  const target = name.toLowerCase();
  const out: PONode[] = [];
  const walk = (x: PONode) => {
    if (lname(x) === target) out.push(x);
    for (const c of childrenOf(x)) walk(c);
  };
  walk(n);
  return out;
}
function textDeep(n: PONode): string {
  let out = "";
  const walk = (x: PONode) => {
    if (isTextNode(x)) { out += textOf(x); return; }
    for (const c of childrenOf(x)) walk(c);
  };
  walk(n);
  return out.trim();
}

/* ===================== Level detection for gliederungskennzahl ===================== */

function levelFromCode(code: string): number {
  const s = String(code).trim();
  const digits = s.replace(/\D/g, ""); // be safe
  if (!digits) return 1;
  // Common GII scheme: 2-digit root for the top (e.g., "10"), then 3-digit chunks
  // Examples: "10" (L=1), "10010" (L=2), "10010010" (L=3)
  if (/^\d{2}(?:\d{3})*$/.test(digits)) {
    const len = digits.length;
    if (len <= 2) return 1;
    return 1 + Math.floor((len - 2) / 3);
  }
  // Fallback heuristic
  if (digits.length <= 2) return 1;
  return 1 + Math.ceil((digits.length - 2) / 3);
}

/* ===================== Inline → Markdown ===================== */

function renderInlineToMd(nodes: PONode[]): string {
  let out = "";

  const renderChildren = (arr: PONode[]) => {
    const start = out.length;
    for (const c of arr) walk(c);
    return out.slice(start);
  };

  const walk = (n: PONode) => {
    const t = lname(n);
    if (!t) { if (isTextNode(n)) out += textOf(n); return; }
    const kids = childrenOf(n);

    switch (t) {
      case "b": out += "**" + renderChildren(kids) + "**"; break;
      case "i": out += "*" + renderChildren(kids) + "*"; break;
      case "u": out += "<u>" + renderChildren(kids) + "</u>"; break;
      case "sup": out += "<sup>" + renderChildren(kids) + "</sup>"; break;
      case "sub": out += "<sub>" + renderChildren(kids) + "</sub>"; break;
      case "small": out += "<small>" + renderChildren(kids) + "</small>"; break;
      case "br": out += "<br />"; break;
      case "noindex": out += renderChildren(kids); break; // marker like "(1)"
      case "fnr": {
        const at = attrsOf(n);
        const id = at.ID ?? at.Id ?? at.id ?? renderChildren(kids);
        if (id) out += `[^${String(id).trim()}]`;
        break;
      }
      default:
        out += renderChildren(kids); // unknown inline → flatten text
    }
  };

  for (const n of nodes) walk(n);
  return out;
}

/* ===================== Lists ===================== */

type MarkerClass = { kind: ListKind; style: ListStyle; marker?: string; symbol?: string };

function classifyMarker(raw: string): MarkerClass {
  const m = raw.trim();

  // Ordered (arabic)
  if (/^\(?\d+\)?[.)]?$/.test(m)) return { kind: "ordered", style: "arabic", marker: m };
  // Ordered (alpha)
  if (/^[a-z]\)$/.test(m)) return { kind: "ordered", style: "alpha-lower", marker: m };
  if (/^[A-Z]\)$/.test(m)) return { kind: "ordered", style: "alpha-upper", marker: m };
  // Ordered (roman)
  if (/^[ivxlcdm]+\)$/.test(m)) return { kind: "ordered", style: "roman-lower", marker: m };
  if (/^[IVXLCDM]+\)$/.test(m)) return { kind: "ordered", style: "roman-upper", marker: m };

  // Unordered common
  if (m === "•") return { kind: "unordered", style: "bullet" };
  if (m === "-" || m === "–" || m === "—") return { kind: "unordered", style: "dash" };

  // Fallback unordered custom
  return { kind: "unordered", style: "custom", symbol: m };
}

function parseList(dl: PONode): ListNode {
  const kids = childrenOf(dl);
  const items: ListItemNode[] = [];
  let pendingMarker: string | undefined;
  let listKind: ListKind = "unordered";
  let listStyle: ListStyle = "custom";
  let listSymbol: string | undefined;
  let buf: Array<TextRun | ParagraphNode | ListNode> = [];

  const flush = () => {
    if (pendingMarker == null && buf.length === 0) return;
    const li: ListItemNode = { type: "li", children: buf };
    if (listKind === "ordered" && pendingMarker) li.marker = pendingMarker;
    items.push(li);
    pendingMarker = undefined;
    buf = [];
  };

  for (const node of kids) {
    const t = lname(node);
    if (t === "dt") {
      flush();
      const markerText = renderInlineToMd(childrenOf(node)).trim();
      if (items.length === 0) {
        const c = classifyMarker(markerText);
        listKind = c.kind; listStyle = c.style; listSymbol = c.symbol;
      }
      pendingMarker = markerText;
    } else if (t === "dd" || t === "la") {
      const parts = childrenOf(node);
      let textBuf = "";
      const flushText = () => {
        const md = textBuf.trim();
        if (md) buf.push({ type: "md", md });
        textBuf = "";
      };
      for (const part of parts) {
        const pt = lname(part);
        if (!pt) {
          if (isTextNode(part)) textBuf += textOf(part);
        } else if (pt === "dl") {
          flushText();
          buf.push(parseList(part));
        } else if (pt === "p") {
          flushText();
          buf.push(parseParagraph(part));
        } else {
          textBuf += renderInlineToMd([part]);
        }
      }
      flushText();
    }
  }
  flush();

  if (listKind === "unordered") for (const it of items) delete it.marker;

  const out: ListNode = {
    type: "list",
    kind: listKind,
    style: listStyle,
    ...(listKind === "unordered" && listStyle === "custom" && listSymbol
      ? { symbol: listSymbol }
      : {}),
    children: items,
  };
  return out;
}

/* ===================== Paragraphs ===================== */

function parseParagraph(p: PONode): ParagraphNode {
  const kids = childrenOf(p);
  const outChildren: Array<TextRun | ListNode> = [];
  let textBuf = "";

  const flushText = () => {
    const md = textBuf.trim();
    if (md) outChildren.push({ type: "md", md });
    textBuf = "";
  };

  for (const k of kids) {
    const t = lname(k);
    if (!t) {
      if (isTextNode(k)) textBuf += textOf(k);
    } else if (t === "dl") {
      flushText();
      outChildren.push(parseList(k));
    } else {
      textBuf += renderInlineToMd([k]);
    }
  }
  flushText();

  // Leading "(n)" → Abs. n
  if (outChildren.length && outChildren[0].type === "md") {
    const m = outChildren[0].md.match(/^\s*\((\d+)\)\s*/);
    if (m) {
      outChildren[0].md = outChildren[0].md.slice(m[0].length);
      return { type: "p", label: "Abs.", id: m[1], children: outChildren };
    }
  }
  return { type: "p", children: outChildren };
}

/* ===================== Tables ===================== */

function parseTable(tbl: PONode): TableNode {
  const rows: string[][] = [];
  for (const row of allChildren(tbl, "row")) {
    const cells: string[] = [];
    for (const entry of allChildren(row, "entry")) {
      cells.push(renderInlineToMd(childrenOf(entry)).trim());
    }
    rows.push(cells);
  }
  return { type: "table", rows };
}

/* ===================== Articles / Sections / Footnotes ===================== */

function parseArticleEnbez(raw: string): { label: "§" | "Art."; id: string } | null {
  const s = raw.trim();

  // Accept plain § N or §§ ranges (we keep the first number as id if needed).
  let m = s.match(/^§+\s*([\d]+[a-zA-Z]?)$/);
  if (m) return { label: "§", id: m[1] };

  // Artikel / Art.
  m = s.match(/^Art(?:\.|ikel)?\s*([\d]+[a-zA-Z]?)$/i);
  if (m) return { label: "Art.", id: m[1] };

  // Not an article heading we recognize.
  return null;
}

function collectFootnotes(norm: PONode): Footnote[] {
  const out: Footnote[] = [];
  const fns = allDesc(norm, "footnote");
  for (const fn of fns) {
    const at = attrsOf(fn);
    const rawId = at.ID ?? at.Id ?? at.id ?? "";
    const id = String(rawId).trim();
    if (!id) continue;
    const md = renderInlineToMd(childrenOf(fn)).trim();
    out.push({ id, md });
  }
  return out;
}

function parseArticle(norm: PONode): ArticleNode | null {
  const meta = firstChild(norm, "metadaten");
  if (!meta) return null;

  const enbezN = firstChild(meta, "enbez");
  if (!enbezN) return null;

  const enbez = textDeep(enbezN);
  const parsed = parseArticleEnbez(enbez);
  if (!parsed) return null; // <- only accept § / Art.

  const titleN = firstChild(meta, "titel");
  const title = titleN ? textDeep(titleN) : undefined;

  const doknr = attrsOf(norm).doknr;

  const article: ArticleNode = {
    type: "article",
    label: parsed.label,
    id: parsed.id,
    title,
    ...(doknr ? { doknr } : {}),
    children: [],
  };

  const contents = allDesc(norm, "content");
  for (const content of contents) {
    for (const child of childrenOf(content)) {
      const t = lname(child);
      if (!t) continue;
      if (t === "p") article.children.push(parseParagraph(child));
      else if (t === "dl") article.children.push(parseList(child));
      else if (t === "table") article.children.push(parseTable(child));
    }
  }

  const fnotes = collectFootnotes(norm);
  if (fnotes.length) article.footnotes = fnotes;

  return article;
}

/** For non-§/Art. blocks like "Inhaltsübersicht" (TOC), "Vorbemerkung", etc. */
function parseSection(norm: PONode): SectionNode | null {
  const meta = firstChild(norm, "metadaten");
  if (!meta) return null;

  const enbezN = firstChild(meta, "enbez");
  if (!enbezN) return null;

  const enbez = textDeep(enbezN).trim();
  // Skip if it's actually an article
  if (parseArticleEnbez(enbez)) return null;

  const doknr = attrsOf(norm).doknr;

  const section: SectionNode = {
    type: "section",
    title: enbez || undefined,
    ...(doknr ? { doknr } : {}),
    children: [],
  };

  const contents = allDesc(norm, "content");
  for (const content of contents) {
    for (const child of childrenOf(content)) {
      const t = lname(child);
      if (!t) continue;
      if (t === "p") section.children.push(parseParagraph(child));
      else if (t === "dl") section.children.push(parseList(child));
      else if (t === "table") section.children.push(parseTable(child));
    }
  }
  return section;
}

/* ===================== Outline nodes ===================== */

function parseOutline(norm: PONode): OutlineNode | null {
  const meta = firstChild(norm, "metadaten");
  if (!meta) return null;
  const gl = firstChild(meta, "gliederungseinheit");
  if (!gl) return null;

  const codeN = firstChild(gl, "gliederungskennzahl");
  const labelN = firstChild(gl, "gliederungsbez");
  const titleN = firstChild(gl, "gliederungstitel");

  const id = codeN ? textDeep(codeN) : "";
  const label = labelN ? textDeep(labelN) : "";
  const title = titleN ? textDeep(titleN) : undefined;

  if (!id || !label) return null;

  return {
    type: "outline",
    id,
    label,
    ...(title ? { title } : {}),
    level: levelFromCode(id),
    children: [],
  };
}

/* ===================== Main conversion ===================== */

function collectNorms(root: PONode[]): PONode[] {
  const out: PONode[] = [];
  const visit = (n: PONode) => {
    if (lname(n) === "norm") out.push(n);
    for (const c of childrenOf(n)) visit(c);
  };
  for (const n of root) visit(n);
  return out;
}

function convert(xml: string): DocumentNode {
  const po = parser.parse(xml) as PONode[];
  const norms = collectNorms(po);

  const doc: DocumentNode = { type: "document", children: [] };
  const stack: OutlineNode[] = [];

  const pushInto = (node: OutlineNode | ArticleNode | SectionNode) => {
    if (stack.length) stack[stack.length - 1].children.push(node as any);
    else doc.children.push(node as any);
  };

  for (const norm of norms) {
    const outline = parseOutline(norm);
    if (outline) {
      // place by level (now computed correctly for 2 + 3n digits)
      while (stack.length >= outline.level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(outline);
      else doc.children.push(outline);
      stack.push(outline);

      // set doc.jurabk/title once (best-effort)
      if (!doc.jurabk || !doc.title) {
        const meta = firstChild(norm, "metadaten");
        if (meta) {
          if (!doc.jurabk) {
            const j = firstChild(meta, "jurabk");
            if (j) doc.jurabk = textDeep(j);
          }
          if (!doc.title) {
            const t = firstChild(meta, "titel");
            if (t) doc.title = textDeep(t);
          }
        }
      }
      continue;
    }

    const article = parseArticle(norm);
    if (article) { pushInto(article); continue; }

    const section = parseSection(norm);
    if (section) { pushInto(section); continue; }

    // ignore other norm variants (registers, change notes, etc.)
  }

  return doc;
}

/* ===================== CLI ===================== */

if (process.argv[1].endsWith("convert-gii.ts")) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-node convert-gii.ts <input.xml> > out.json");
    process.exit(1);
  }
  const xml = fs.readFileSync(path.resolve(file), "utf8");
  const json = convert(xml);
  if (!json.children.length) {
    console.error("⚠️ Parsed 0 nodes. If your XML uses different tags, send me its root snippet.");
  }
  process.stdout.write(JSON.stringify(json, null, 2));
}

export { convert };