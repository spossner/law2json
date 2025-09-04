/**
 * TypeScript types for German Legal Document JSON structure
 * Simplified unified structure with type, id, label, title, content, meta, and children
 */

// Base node interface - all nodes share this structure
export interface BaseNode {
  type: string;
  id?: string;
  label?: string;
  title?: string;
  content?: string;
  meta?: Record<string, any>;
  children: BaseNode[];
}

// Specific node types
export interface SectionNode extends BaseNode {
  type: 'section';
  id: string;                      // normalized from enbez (e.g., "§1")
  label: string;                   // original enbez (e.g., "§ 1")
  title: string;                   // from titel
  meta: {
    documentId?: string;           // optional document reference
  };
}

export interface StructureNode extends BaseNode {
  type: 'structure';
  id: string;                      // from gliederungskennzahl (e.g., "010")
  label: string;                   // from gliederungsbez (e.g., "Buch 1")
  title: string;                   // from gliederungstitel
}

export interface BlockNode extends BaseNode {
  type: 'block';
}

export interface ListNode extends BaseNode {
  type: 'list';
  meta: {
    listType: 'arabic' | 'alpha' | 'Alpha' | 'a-alpha' | 'a3-alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
  };
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  id?: string;                     // optional ID based on content or position
  children: never[];
}

export interface ListItemNode extends BaseNode {
  type: 'listItem';
  label: string;                   // numbering/bullet marker (e.g., "1.", "a)")
}

export interface ImageNode extends BaseNode {
  type: 'image';
  id?: string;                     // optional ID based on position
  meta: {
    src: string;
    alt?: string;
  };
  children: never[];
}

// Table structures remain complex but follow base pattern
export interface TableNode extends BaseNode {
  type: 'table';
  meta?: {
    frame?: string;
    pgwide?: string;
  };
}

export interface TableGroupNode extends BaseNode {
  type: 'tableGroup';
  meta: {
    cols: number;
  };
}

export interface TableHeaderNode extends BaseNode {
  type: 'tableHeader';
}

export interface TableBodyNode extends BaseNode {
  type: 'tableBody';
}

export interface TableRowNode extends BaseNode {
  type: 'tableRow';
}

export interface TableCellNode extends BaseNode {
  type: 'tableCell';
  meta?: {
    colname?: string;
  };
}

export interface FootnoteNode extends BaseNode {
  type: 'footnote';
  id: string;
}

// Document root with metadata
export interface DocumentNode extends BaseNode {
  type: 'document';
  meta: {
    legalAbbr: string;             // from jurabk (e.g., "BNatSchG 2009")
    officialAbbr: string;          // from amtabk (e.g., "BNatSchG")
    date: string;                  // from ausfertigung-datum (ISO format)
    citation: {
      publication: string;         // from periodikum (e.g., "BGBl I")
      reference: string;           // from zitstelle (e.g., "2009, 2542")
    };
    shortTitle: string;            // from kurzue
    longTitle: string;             // from langue
    notes: string[];               // from standkommentar (array)
    documentId: string;            // from doknr
  };
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