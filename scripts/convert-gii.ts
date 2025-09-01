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
  children: Node[];  // nested outlines/articles/sections
}

export interface ArticleNode {
  type: "article";
  id: string;        // pure number (e.g., "14")
  label: string;     // display label (e.g., "§ 14", "Art. 5")
  title?: string;
  doknr?: string;
  footnotes?: Footnote[];
  children: Node[];
}

export interface SectionNode {
  type: "section";  // e.g., Inhaltsübersicht, Vorbemerkung, …
  title?: string;   // usually from enbez
  doknr?: string;
  children: Node[]; // paragraphs, lists, tables
}

export interface ParagraphNode {
  type: "p";
  label?: "Abs.";
  id?: string;       // hierarchical like "4.1" (Article 4, Abs. 1)
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
  label?: string;            // display label like "1.", "2.", etc.
  id?: string;               // hierarchical like "4.1.2"
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
  parseAttributeValue: false,
  parseTagValue: false,
  parseTrueNumberOnly: false,
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
  const digits = s.replace(/\D/g, "");
  if (!digits) return 1;
  return Math.ceil(digits.length / 3);
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
      case "noindex": out += renderChildren(kids); break;
      case "fnr": {
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

/* ===================== Lists ===================== */

type MarkerClass = { kind: ListKind; style: ListStyle; label?: string; symbol?: string };

function classifyMarker(raw: string): MarkerClass {
  const m = raw.trim();
  if (/^\(?\d+\)?[.)]?$/.test(m)) return { kind: "ordered", style: "arabic", label: m };
  if (/^[a-z]\)$/.test(m)) return { kind: "ordered", style: "alpha-lower", label: m };
  if (/^[A-Z]\)$/.test(m)) return { kind: "ordered", style: "alpha-upper", label: m };
  if (/^[ivxlcdm]+\)$/.test(m)) return { kind: "ordered", style: "roman-lower", label: m };
  if (/^[IVXLCDM]+\)$/.test(m)) return { kind: "ordered", style: "roman-upper", label: m };
  if (m === "•") return { kind: "unordered", style: "bullet" };
  if (m === "-" || m === "–" || m === "—") return { kind: "unordered", style: "dash" };
  return { kind: "unordered", style: "custom", symbol: m };
}

function parseList(dl: PONode, idPrefix: string = ""): ListNode {
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
    
    // Always use the exact DT content as the label
    if (pendingMarker) li.label = pendingMarker;
    
    // Generate hierarchical ID for list item
    if (idPrefix && pendingMarker) {
      // Extract number from marker (e.g., "1." -> "1", "(2)" -> "2")
      const markerNum = pendingMarker.match(/\d+/)?.[0];
      if (markerNum) {
        (li as any).id = `${idPrefix}.${markerNum}`;
      }
    }
    
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
          // Generate nested list ID prefix
          const nestedPrefix = idPrefix && pendingMarker ? 
            `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || "1"}` : idPrefix;
          buf.push(parseList(part, nestedPrefix));
        } else if (pt === "p") {
          flushText();
          const nestedPrefix = idPrefix && pendingMarker ? 
            `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || "1"}` : idPrefix;
          buf.push(parseParagraph(part, nestedPrefix));
        } else {
          textBuf += renderInlineToMd([part]);
        }
      }
      flushText();
    }
  }
  flush();

  if (listKind === "unordered") for (const it of items) delete it.label;

  return {
    type: "list",
    kind: listKind,
    style: listStyle,
    ...(listKind === "unordered" && listStyle === "custom" && listSymbol
      ? { symbol: listSymbol }
      : {}),
    children: items,
  };
}

/* ===================== Paragraphs ===================== */

function parseParagraph(p: PONode, idPrefix: string = ""): ParagraphNode {
  const kids = childrenOf(p);
  const outChildren: Array<TextRun | ListNode> = [];
  let textBuf = "";

  const flushText = () => {
    const md = textBuf.trim();
    if (md) outChildren.push({ type: "md", md });
    textBuf = "";
  };

  // Extract paragraph number first to build proper ID context
  let paragraphId = idPrefix;
  let paragraphNumber: string | undefined;
  
  // Check if first text starts with paragraph number
  for (const k of kids) {
    if (isTextNode(k)) {
      const text = textOf(k).trim();
      const m = text.match(/^\s*\((\d+)\)\s*/);
      if (m) {
        paragraphNumber = m[1];
        paragraphId = idPrefix ? `${idPrefix}.${paragraphNumber}` : paragraphNumber;
        break;
      }
    }
  }

  for (const k of kids) {
    const t = lname(k);
    if (!t) {
      if (isTextNode(k)) textBuf += textOf(k);
    } else if (t === "dl") {
      flushText();
      // Use the full paragraph ID as context for lists
      outChildren.push(parseList(k, paragraphId));
    } else {
      textBuf += renderInlineToMd([k]);
    }
  }
  flushText();

  if (outChildren.length && outChildren[0].type === "md" && paragraphNumber) {
    const m = outChildren[0].md.match(/^\s*\((\d+)\)\s*/);
    if (m) {
      outChildren[0].md = outChildren[0].md.slice(m[0].length);
      return { type: "p", label: `(${paragraphNumber})`, id: paragraphId, children: outChildren };
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

function parseArticleEnbez(raw: string): { label: string; id: string } | null {
  const s = raw.trim();
  let m = s.match(/^§+\s*([\d]+[a-zA-Z]?)$/);
  if (m) return { label: `§ ${m[1]}`, id: m[1] };
  m = s.match(/^Art(?:\.|ikel)?\s*([\d]+[a-zA-Z]?)$/i);
  if (m) return { label: `Art. ${m[1]}`, id: m[1] };
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
  if (!parsed) return null; // only accept § / Art.

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
      if (t === "p") article.children.push(parseParagraph(child, parsed.id));
      else if (t === "dl") article.children.push(parseList(child, parsed.id));
      else if (t === "table") article.children.push(parseTable(child));
    }
  }

  const fnotes = collectFootnotes(norm);
  if (fnotes.length) article.footnotes = fnotes;

  return article;
}

function parseSection(norm: PONode): SectionNode | null {
  const meta = firstChild(norm, "metadaten");
  if (!meta) return null;

  const enbezN = firstChild(meta, "enbez");
  if (!enbezN) return null;

  const enbez = textDeep(enbezN).trim();
  if (parseArticleEnbez(enbez)) return null; // already handled as article

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

type OutlineParse = { node: OutlineNode; level: number };

function parseOutline(norm: PONode): OutlineParse | null {
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

  const level = levelFromCode(id);
  const node: OutlineNode = {
    type: "outline",
    id,
    label,
    ...(title ? { title } : {}),
    children: [],
  };
  return { node, level };
}

/* ===================== Document metadata extraction ===================== */

function extractLawMetadata(norm: PONode, doc: DocumentNode): void {
  const meta = firstChild(norm, "metadaten");
  if (!meta) return;

  // Extract abbreviation (jurabk)
  if (!doc.jurabk) {
    const j = firstChild(meta, "jurabk");
    if (j) {
      const jurabk = textDeep(j).trim();
      // Clean up format like "BNatSchG 2009" -> "BNatSchG"
      doc.jurabk = jurabk.replace(/\s+\d{4}$/, "");
    }
  }

  // Extract title - try multiple sources
  if (!doc.title) {
    // Try long title first (langue)
    const lange = firstChild(meta, "langue");
    if (lange) {
      doc.title = textDeep(lange).trim();
    } else {
      // Try short title (kurzue)
      const kurz = firstChild(meta, "kurzue");
      if (kurz) {
        doc.title = textDeep(kurz).trim();
      } else {
        // Fallback to artikel title
        const titel = firstChild(meta, "titel");
        if (titel) {
          doc.title = textDeep(titel).trim();
        }
      }
    }
  }
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
  
  // Extract law metadata early from the first applicable norm
  for (const norm of norms) {
    extractLawMetadata(norm, doc);
    if (doc.jurabk && doc.title) break; // Stop once we have both
  }

  const pushInto = (node: OutlineNode | ArticleNode | SectionNode) => {
    if (stack.length) stack[stack.length - 1].children.push(node as any);
    else doc.children.push(node as any);
  };

  for (const norm of norms) {
    const parsedOutline = parseOutline(norm);
    if (parsedOutline) {
      const { node, level } = parsedOutline;
      while (stack.length >= level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else doc.children.push(node);
      stack.push(node);

      // set doc.jurabk/title once (best-effort)  
      extractLawMetadata(norm, doc);
      continue;
    }

    const article = parseArticle(norm);
    if (article) { 
      extractLawMetadata(norm, doc);
      pushInto(article); 
      continue; 
    }

    const section = parseSection(norm);
    if (section) { 
      extractLawMetadata(norm, doc);
      pushInto(section); 
      continue; 
    }

    // ignore other norm variants
  }

  return doc;
}

/* ===================== CLI ===================== */

if (process.argv[1] && process.argv[1].endsWith("convert-gii.ts")) {
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
