/**
 * TypeScript types for German Legal Document JSON structure (new parser)
 * Matches the interfaces from convert-gii.ts
 */

// Basic content and list types
export type ListKind = 'ordered' | 'unordered';
export type ListStyle =
  | 'arabic'
  | 'alpha-lower'
  | 'alpha-upper'
  | 'roman-lower'
  | 'roman-upper'
  | 'bullet'
  | 'dash'
  | 'custom';

export interface TextRun {
  type: 'md';
  md: string; // Markdown (+ tiny HTML: u/small/sup/sub/br)
}

export interface ListItemNode {
  type: 'li';
  label?: string; // display label like "1.", "2.", etc.
  id?: string; // hierarchical like "4.1.2"
  children: Array<TextRun | ParagraphNode | ListNode>;
}

export interface ListNode {
  type: 'list';
  kind: ListKind;
  style: ListStyle;
  symbol?: string; // for custom style
  children: ListItemNode[];
}

export interface TableNode {
  type: 'table';
  rows: string[][]; // rows of Markdown cells
}

export interface Footnote {
  id: string; // referenced by [^id]
  md: string; // Markdown + tiny HTML
}

// Hierarchical structure types
export interface ParagraphNode {
  type: 'p';
  label?: string; // e.g., "(1)", "(2)" for numbered paragraphs
  id?: string; // hierarchical like "4.1" (Article 4, Abs. 1)
  children: Array<TextRun | ListNode>;
}

export interface ArticleNode {
  type: 'article';
  id: string; // pure number (e.g., "14")
  label: string; // display label (e.g., "§ 14", "Art. 5")
  title?: string;
  doknr?: string;
  footnotes?: Footnote[];
  children: Array<ParagraphNode | ListNode | TableNode>;
}

export interface SectionNode {
  type: 'section'; // e.g., Inhaltsübersicht, Vorbemerkung, …
  id?: string; // unique identifier
  label?: string; // display label
  title?: string; // usually from enbez
  doknr?: string;
  children: Array<ParagraphNode>;
}

export interface OutlineNode {
  type: 'outline';
  id: string; // gliederungskennzahl
  label: string; // gliederungsbez
  title?: string; // gliederungstitel
  children: Array<OutlineNode | ArticleNode | SectionNode>;
}

export interface DocumentNode {
  type: 'document';
  jurabk?: string; // law abbreviation
  title?: string; // law title
  children: Array<SectionNode | OutlineNode>;
}

// Union types for navigation
export type NavigableNode = DocumentNode | OutlineNode | ArticleNode | SectionNode | ParagraphNode;
export type ContentNode = TextRun | ListNode | TableNode;
export type LawNode = NavigableNode | ContentNode | ListItemNode;

// Legacy compatibility - keeping old interface name but with new structure
export interface LawDocument extends DocumentNode {}

// Helper type for elements that can be selected in navigation (all hierarchical levels)
export type SelectableElement = OutlineNode | ArticleNode | SectionNode | ParagraphNode;

// Export aliases for backward compatibility
export type StructuralElement = SelectableElement;
export type ContentElement = ContentNode;
