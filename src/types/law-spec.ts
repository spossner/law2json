/**
 * TypeScript types for German Legal Document JSON structure
 * Following the specification in docs/law-json-spec.md
 */

// Base node interface
export interface BaseNode {
  type: string;
  children: Node[];
}

// Document metadata
export interface DocumentMeta {
  legalAbbr: string;           // from jurabk (e.g., "BNatSchG 2009")
  officialAbbr: string;        // from amtabk (e.g., "BNatSchG")
  date: string;                // from ausfertigung-datum (ISO format)
  citation: {
    publication: string;       // from periodikum (e.g., "BGBl I")
    reference: string;         // from zitstelle (e.g., "2009, 2542")
  };
  shortTitle: string;          // from kurzue
  longTitle: string;           // from langue
  notes: string[];             // from standkommentar (array)
  documentId: string;          // from doknr
}

// Structure node metadata
export interface StructureMeta {
  id: string;                  // from gliederungskennzahl
  label: string;               // from gliederungsbez (e.g., "Kapitel 5")
  title: string;               // from gliederungstitel
}

// Section node metadata  
export interface SectionMeta {
  id: string;                  // normalized from enbez (e.g., "§44")
  label: string;               // original enbez (e.g., "§ 44")
  title: string;               // from titel
  documentId?: string;         // optional document reference
}

// Node types
export interface DocumentNode extends BaseNode {
  type: 'document';
  meta: DocumentMeta;
  children: (StructureNode | SectionNode)[];
}

export interface StructureNode extends BaseNode {
  type: 'structure';
  meta: StructureMeta;
  children: (StructureNode | SectionNode)[];
}

export interface SectionNode extends BaseNode {
  type: 'section';
  meta: SectionMeta;
  children: BlockNode[];
}

export interface BlockNode extends BaseNode {
  type: 'block';
  children: ContentNode[];
}

// Content types within blocks
export interface TextNode {
  type: 'text';
  content: string;
  id?: string;                     // optional ID based on content or position
  children: never[];
}

export interface ListNode extends BaseNode {
  type: 'list';
  listType: 'arabic' | 'alpha' | 'Alpha' | 'a-alpha' | 'a3-alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
  children: ListItemNode[];
}

export interface ListItemNode extends BaseNode {
  type: 'listItem';
  label: string;               // numbering/bullet marker (e.g., "1.", "a)")
  id?: string;                 // optional ID based on label
  children: ContentNode[];     // mixed content - text, nested lists, etc.
}

// Table structures
export interface TableNode extends BaseNode {
  type: 'table';
  meta?: {
    frame?: string;
    pgwide?: string;
  };
  children: TableGroupNode[];
}

export interface TableGroupNode extends BaseNode {
  type: 'tableGroup';
  cols: number;
  children: (TableHeaderNode | TableBodyNode)[];
}

export interface TableHeaderNode extends BaseNode {
  type: 'tableHeader';
  children: TableRowNode[];
}

export interface TableBodyNode extends BaseNode {
  type: 'tableBody';
  children: TableRowNode[];
}

export interface TableRowNode extends BaseNode {
  type: 'tableRow';
  children: TableCellNode[];
}

export interface TableCellNode extends BaseNode {
  type: 'tableCell';
  colname?: string;
  children: ContentNode[];
}

// Other content types
export interface ImageNode {
  type: 'image';
  src: string;
  alt?: string;
  id?: string;                     // optional ID based on position
  children: never[];
}

export interface FootnoteNode {
  type: 'footnote';
  id: string;
  children: ContentNode[];
}


// Union types
export type ContentNode = 
  | TextNode 
  | ListNode 
  | TableNode 
  | ImageNode 
  | FootnoteNode;

export type Node = 
  | DocumentNode 
  | StructureNode 
  | SectionNode 
  | BlockNode 
  | ContentNode 
  | ListItemNode
  | TableGroupNode
  | TableHeaderNode
  | TableBodyNode
  | TableRowNode
  | TableCellNode;

// Helper types for navigation
export type NavigableNode = DocumentNode | StructureNode | SectionNode;
export type SelectableNode = StructureNode | SectionNode | BlockNode;