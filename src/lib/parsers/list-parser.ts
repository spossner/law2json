import type { 
  ListNode, 
  ListItemNode, 
  ListKind, 
  ListStyle, 
  TextRun, 
  ParagraphNode 
} from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { 
  childrenOf, 
  lname, 
  isTextNode, 
  textOf, 
  renderInlineToMd 
} from '../converter-utils.ts';

type MarkerClass = { kind: ListKind; style: ListStyle; label?: string; symbol?: string };

function classifyMarker(raw: string): MarkerClass {
  const m = raw.trim();
  if (/^\(?\d+\)?[.)]?$/.test(m)) return { kind: 'ordered', style: 'arabic', label: m };
  if (/^[a-z]\)$/.test(m)) return { kind: 'ordered', style: 'alpha-lower', label: m };
  if (/^[A-Z]\)$/.test(m)) return { kind: 'ordered', style: 'alpha-upper', label: m };
  if (/^[ivxlcdm]+\)$/.test(m)) return { kind: 'ordered', style: 'roman-lower', label: m };
  if (/^[IVXLCDM]+\)$/.test(m)) return { kind: 'ordered', style: 'roman-upper', label: m };
  if (m === '•') return { kind: 'unordered', style: 'bullet' };
  if (m === '-' || m === '–' || m === '—') return { kind: 'unordered', style: 'dash' };
  return { kind: 'unordered', style: 'custom', symbol: m };
}

/**
 * Parser for definition list elements ('<dl>' tags)
 */
export class ListParser implements Parser<ListNode> {
  readonly elementName = 'dl';

  parse(dl: PONode, idPrefix: string = ''): ListNode | null {
    const kids = childrenOf(dl);
    const items: ListItemNode[] = [];
    let pendingMarker: string | undefined;
    let listKind: ListKind = 'unordered';
    let listStyle: ListStyle = 'custom';
    let listSymbol: string | undefined;
    let buf: Array<TextRun | ParagraphNode | ListNode> = [];

    const flush = () => {
      if (pendingMarker == null && buf.length === 0) return;
      const li: ListItemNode = { type: 'li', children: buf };

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
      if (t === 'dt') {
        flush();
        const markerText = renderInlineToMd(childrenOf(node)).trim();
        if (items.length === 0) {
          const c = classifyMarker(markerText);
          listKind = c.kind;
          listStyle = c.style;
          listSymbol = c.symbol;
        }
        pendingMarker = markerText;
      } else if (t === 'dd' || t === 'la') {
        const parts = childrenOf(node);
        let textBuf = '';
        const flushText = () => {
          const md = textBuf.trim();
          if (md) buf.push({ type: 'md', md });
          textBuf = '';
        };
        for (const part of parts) {
          const pt = lname(part);
          if (!pt) {
            if (isTextNode(part)) textBuf += textOf(part);
          } else if (pt === 'dl') {
            flushText();
            // Generate nested list ID prefix
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            // Recursive call for nested lists
            const nestedList = this.parse(part, nestedPrefix);
            if (nestedList) buf.push(nestedList);
          } else if (pt === 'p') {
            flushText();
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            // Note: We'll need to get the paragraph parser from registry
            const paragraphResult = this.parseNestedParagraph?.(part, nestedPrefix);
            if (paragraphResult) buf.push(paragraphResult);
          } else {
            textBuf += renderInlineToMd([part]);
          }
        }
        flushText();
      }
    }
    flush();

    if (listKind === 'unordered') for (const it of items) delete it.label;

    return {
      type: 'list',
      kind: listKind,
      style: listStyle,
      ...(listKind === 'unordered' && listStyle === 'custom' && listSymbol
        ? { symbol: listSymbol }
        : {}),
      children: items,
    };
  }

  // Temporary solution for nested paragraph parsing - will be resolved with dependency injection
  private parseNestedParagraph?: (node: PONode, idPrefix: string) => ParagraphNode | null;

  setNestedParagraphParser(parser: (node: PONode, idPrefix: string) => ParagraphNode | null): void {
    this.parseNestedParagraph = parser;
  }
}