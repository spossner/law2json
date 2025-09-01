/**
 * TypeScript types for German Legal Document JSON structure (new parser)
 * Matches the interfaces from convert-gii.ts
 */

// Basic content types
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
  listType: string; // DTD value: 'arabic' | 'alpha' | 'Alpha' | 'a-alpha' | 'a3-alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None'
  children: ListItemNode[];
}

export interface TableNode {
  type: 'table';
  headers?: string[]; // optional header row
  rows: string[][]; // body rows of Markdown cells
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
  children: Array<TextRun | ListNode | TableNode>;
}

export interface ElementNode {
  type: 'element';
  id: string; // from enbez (e.g., "14", "Anlage 1", "Inhaltsübersicht")
  label: string; // display label (e.g., "§ 14", "Art. 5", "Anlage 1")
  title?: string; // from titel element
  doknr?: string;
  footnotes?: Footnote[];
  children: Array<ParagraphNode | ListNode | TableNode>;
}

export interface StructureNode {
  type: 'structure'; // hierarchical structure like chapters, sections
  id: string; // gliederungskennzahl
  label: string; // gliederungsbez
  title?: string; // gliederungstitel
  children: Array<StructureNode | ElementNode>;
}

export interface DocumentNode {
  type: 'document';
  jurabk?: string; // law abbreviation
  title?: string; // law title
  children: Array<ElementNode | StructureNode>;
}

// Union types for navigation
export type NavigableNode = DocumentNode | StructureNode | ElementNode | ParagraphNode;
export type ContentNode = TextRun | ListNode | TableNode;
export type LawNode = NavigableNode | ContentNode | ListItemNode;

// Legacy compatibility - keeping old interface name but with new structure
export interface LawDocument extends DocumentNode {}

// Helper type for elements that can be selected in navigation (all hierarchical levels)
export type SelectableElement = StructureNode | ElementNode | ParagraphNode;

// Export aliases for backward compatibility
export type StructuralElement = SelectableElement;
export type ContentElement = ContentNode;
