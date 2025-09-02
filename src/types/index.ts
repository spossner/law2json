/**
 * TypeScript types for German Legal Document JSON structure (new parser)
 * Matches the interfaces from convert-gii.ts
 */

// Basic content types
export interface TextRun {
  type: 'md';
  id?: string;
  md: string; // Markdown (+ tiny HTML: u/small/sup/sub/br)
}

export interface ListItemNode {
  type: 'li';
  label?: string; // display label like "1.", "2.", etc.
  id?: string; // hierarchical like "4.1.2"
  children: Array<ContentNode>;
}

export interface ListNode {
  type: 'list';
  id?: string;
  listType: 'arabic' | 'alpha' | 'Alpha' | 'a-alpha' | 'a3-alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
  children: ListItemNode[];
}

export interface TableCell {
  content: string;
  colspan?: number; // optional colspan, defaults to 1
}

export interface ImageNode {
  type: 'image';
  id?: string;
  src: string; // image filename
  alt?: string; // alt text
  width?: number; // width in pixels or units
  height?: number; // height in pixels or units
  align?: string; // alignment: 'left' | 'center' | 'right'
  position?: 'block' | 'inline'; // display position
}

export interface TableNode {
  type: 'table';
  id?: string;
  headers?: Array<string | TableCell>; // header cells can have colspan
  rows: Array<Array<string | TableCell>>; // body rows can have cells with colspan
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
  title?: string; // from titel element
  children: Array<ContentNode>;
}

export interface ElementNode {
  type: 'element';
  id: string; // from enbez (e.g., "14", "Anlage 1", "Inhaltsübersicht")
  label: string; // display label (e.g., "§ 14", "Art. 5", "Anlage 1")
  title?: string; // from titel element
  doknr?: string;
  footnotes?: Footnote[];
  children: Array<ContentNode>;
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
  children: Array<StructureNode | ElementNode>;
}

// Union types for navigation
export type NavigableNode = DocumentNode | StructureNode | ElementNode | ParagraphNode;
export type ContentNode = TextRun | ListNode | TableNode | ImageNode;
export type LawNode = NavigableNode | ContentNode | ListItemNode;

// Helper type for elements that can be selected in navigation (all hierarchical levels)
export type SelectableElement = StructureNode | ElementNode | ParagraphNode;
export type RenderableElement = SelectableElement | ContentNode;

// Export aliases for backward compatibility
export type StructuralElement = SelectableElement;
export type ContentElement = ContentNode;
