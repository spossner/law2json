/**
 * TypeScript types for German Legal Document JSON structure
 * Simplified unified structure with type, id, label, title, content, meta, and children
 */

/**
 * 1st Level Nodes
 * Structure or Section
 */
export interface SectionNode {
  type: 'section';
  id: string; // normalized from enbez (e.g., "§1")
  text: string; // combined as "<label> <title>"
  meta: {
    documentId?: string; // optional document reference
  };
  children: BlockNode[];
}

export interface StructureNode {
  type: 'structure';
  id: string; // from gliederungskennzahl (e.g., "010")
  text: string; // combined as "<label> - <title>"
  children: SelectableNode[];
}

export interface BlockNode {
  type: 'block';
  id: string;
  children: ContentNode[];
}

export interface ListNode {
  type: 'list';
  id: string;
  meta: {
    listType:
      | 'arabic'
      | 'alpha'
      | 'Alpha'
      | 'a-alpha'
      | 'a3-alpha'
      | 'roman'
      | 'Roman'
      | 'Dash'
      | 'Bullet'
      | 'Symbol'
      | 'None';
  };
  children: ListItemNode[];
}

export interface TextNode {
  type: 'text';
  text: string; // content text
  id?: string; // optional ID based on content or position
  children: never[];
}

export interface ListItemNode {
  type: 'listItem';
  id: string;
  text: string; // numbering/bullet marker (e.g., "1.", "a)")
  children: ContentNode[];
}

export interface ImageNode {
  type: 'image';
  id?: string; // optional ID based on position
  meta: {
    src: string;
    alt?: string;
    height?: string;
    width?: string;
    align?: HorizontalAlign;
    type?: string;
  };
  children: never[];
}

export interface TableNode {
  type: 'table';
  id?: string;
  columnNames: string[]; // Array of column names in order
  head?: TableHead;
  body?: TableBody;
}

export interface TableHead {
  rows: TableRow[];
}

export interface TableBody {
  rows: TableRow[];
}

export interface TableRow {
  valign?: VerticalAlign;
  cells: TableCell[];
}

export interface TableCell {
  colspan?: number;
  content: ContentNode[];
}

export interface FootnoteNode {
  type: 'footnote';
  id: string;
}

// Document root with metadata
export interface DocumentNode {
  type: 'document';
  meta: {
    jurabk: string; // e.g., "BNatSchG 2009"
    amtabk: string; // e.g., "BNatSchG"
    'ausfertigung-datum': string; // ISO format
    fundstelle: {
      periodikum: string; // e.g., "BGBl I"
      zitstelle: string; // e.g., "2009, 2542"
    };
    kurzue: string;
    langue: string;
    standkommentar: string[];
    doknr: string;
  };
  children: (SectionNode | StructureNode)[];
}

// Union types
export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type ContentNode = TextNode | ListNode | TableNode | ImageNode | FootnoteNode | ListItemNode;

export type Node =
  | DocumentNode
  | StructureNode
  | SectionNode
  | BlockNode
  | ContentNode
  | TableHead
  | TableBody
  | TableRow
  | TableCell;

// Helper types for navigation
export type SelectableNode = StructureNode | SectionNode;
