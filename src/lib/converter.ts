import type { 
  DocumentNode, 
  StructureNode, 
  SectionNode, 
  BlockNode,
  TextNode,
  ListNode,
  ListItemNode,
  TableNode,
  ContentNode,
  DocumentMeta,
  TableGroupNode,
  TableHeaderNode,
  TableBodyNode,
  TableRowNode,
  TableCellNode,
  ImageNode
} from '../types/law-spec.ts';

import {
  parser,
  type PONode,
  firstChild,
  textDeep,
  attrsOf,
  childrenOf,
  lname,
  levelFromCode,
  isTextNode,
  textOf,
  allChildren
} from './converter-utils.ts';

/* ===================== Helper Functions ===================== */

/**
 * Normalize IDs by removing spaces but keeping special characters
 * Examples: "§ 44" → "§44", "Anlage 1" → "Anlage1"
 */
function normalizeId(enbez: string): string {
  return enbez.replace(/\s+/g, '');
}

/**
 * Extract text content with basic formatting preserved
 */
function extractTextContent(nodes: PONode[]): string {
  let result = '';
  
  const processNode = (node: PONode): void => {
    if (isTextNode(node)) {
      result += textOf(node);
      return;
    }
    
    const tagName = lname(node);
    const children = childrenOf(node);
    
    switch (tagName) {
      case 'b':
        result += '**';
        children.forEach(processNode);
        result += '**';
        break;
      case 'i':
        result += '*';
        children.forEach(processNode);
        result += '*';
        break;
      case 'br':
        result += '\n';
        break;
      case 'u':
      case 'sup':
      case 'sub':
      case 'small':
        result += `<${tagName}>`;
        children.forEach(processNode);
        result += `</${tagName}>`;
        break;
      default:
        children.forEach(processNode);
    }
  };
  
  nodes.forEach(processNode);
  return result.trim();
}

/**
 * Determine list type based on XML attributes and content
 */
function determineListType(listNode: PONode): ListNode['listType'] {
  const attrs = attrsOf(listNode);
  const type = attrs.type || attrs.listType;
  
  if (type) {
    const typeMap: Record<string, ListNode['listType']> = {
      'arabic': 'arabic',
      'alpha': 'alpha', 
      'Alpha': 'Alpha',
      'roman': 'roman',
      'Roman': 'Roman'
    };
    return typeMap[type] || 'arabic';
  }
  
  // Try to infer from first list item
  const firstItem = firstChild(listNode, 'li') || firstChild(listNode, 'la');
  if (firstItem) {
    const itemText = textDeep(firstItem);
    if (/^\d+\./.test(itemText)) return 'arabic';
    if (/^[a-z]\)/.test(itemText)) return 'alpha';
    if (/^[A-Z]\)/.test(itemText)) return 'Alpha';
    if (/^[ivx]+\)/.test(itemText)) return 'roman';
    if (/^[IVX]+\)/.test(itemText)) return 'Roman';
  }
  
  return 'arabic'; // default
}

/**
 * Extract list item label (number/letter/bullet)
 */
function extractListItemLabel(itemNode: PONode): string {
  const text = textDeep(itemNode);
  const match = text.match(/^(\d+\.|[a-zA-Z]\)|[ivxIVX]+\)|-|\*)/);
  return match ? match[1] : '';
}

/* ===================== ID Generation Helpers ===================== */

/**
 * Generate ID for text nodes based on content
 * If text starts with "(n) ..." returns "<parentId>.n"
 * Otherwise returns "<parentId>#index" (or just parentId if only child)
 */
function generateTextId(parentId: string, index: number, isOnlyChild: boolean): string {
  // For non-paragraph text, use index-based ID
  if (isOnlyChild) {
    return parentId;
  }
  return `${parentId}#${index}`;
}

/**
 * Generate ID for list items based on label
 * Extracts alphanumeric part from label: "a)" → "a", "1." → "1"
 * Returns "<parentId>.extracted"
 */
function generateListItemId(label: string, parentId?: string): string {
  // Extract alphanumeric characters from label
  const cleanLabel = label.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanLabel) {
    return parentId ? `${parentId}.${cleanLabel}` : cleanLabel;
  }
  // Fallback for labels without alphanumeric content
  return parentId ? `${parentId}.item` : 'item';
}

/**
 * Generate ID for image nodes
 * Returns "<parentId>#index" (or just parentId if only child)
 */
function generateImageId(parentId: string, index: number, isOnlyChild: boolean): string {
  if (isOnlyChild) {
    return parentId;
  }
  return `${parentId}#${index}`;
}

/* ===================== Content Parsing ===================== */

/**
 * Parse mixed content within blocks, handling text, lists, tables, etc.
 */
function parseContentNodes(nodes: PONode[], parentId?: string): ContentNode[] {
  const result: ContentNode[] = [];
  let textBuffer: PONode[] = [];
  
  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      const content = extractTextContent(textBuffer);
      if (content.trim()) {
        const textNode: TextNode = {
          type: 'text',
          content: content.trim(),
          children: []
        };
        
        // Add ID if parentId is provided
        if (parentId) {
          const currentIndex = result.length;
          const willBeOnlyChild = currentIndex === 0 && nodes.filter(n => !isTextNode(n) || textDeep(n).trim()).length === 1;
          textNode.id = generateTextId(parentId, currentIndex, willBeOnlyChild);
        }
        
        result.push(textNode);
      }
      textBuffer = [];
    }
  };
  
  for (const node of nodes) {
    if (isTextNode(node)) {
      textBuffer.push(node);
      continue;
    }
    
    const tagName = lname(node);
    
    switch (tagName) {
      case 'dl':
      case 'liste':
      case 'ol':
      case 'ul': {
        flushTextBuffer();
        result.push(parseList(node, parentId));
        break;
      }
      
      case 'tabelle':
      case 'table': {
        flushTextBuffer();
        result.push(parseTable(node));
        break;
      }
      
      case 'img': {
        flushTextBuffer();
        const attrs = attrsOf(node);
        const imageNode: ImageNode = {
          type: 'image',
          src: attrs.src || '',
          alt: attrs.alt,
          children: []
        };
        
        // Add ID if parentId is provided
        if (parentId) {
          const currentIndex = result.length;
          const willBeOnlyChild = currentIndex === 0 && nodes.length === 1;
          imageNode.id = generateImageId(parentId, currentIndex, willBeOnlyChild);
        }
        
        result.push(imageNode);
        break;
      }
      
      // LA elements (list articles) need special handling
      case 'la': {
        flushTextBuffer();
        // Parse LA content which may contain nested lists and text
        const laContent = parseContentNodes(childrenOf(node), parentId);
        result.push(...laContent);
        break;
      }
      
      // Inline formatting elements go to text buffer
      case 'b':
      case 'i':
      case 'u':
      case 'sup':
      case 'sub':
      case 'small':
      case 'br':
        textBuffer.push(node);
        break;
      
      default:
        // Unknown elements also go to text buffer
        textBuffer.push(node);
    }
  }
  
  flushTextBuffer();
  return result;
}


/**
 * Parse lists with proper nesting support
 */
function parseList(listNode: PONode, parentId?: string): ListNode {
  const listType = determineListType(listNode);
  const children: ListItemNode[] = [];
  const nodeChildren = childrenOf(listNode);
  
  for (let i = 0; i < nodeChildren.length; i++) {
    const child = nodeChildren[i];
    const tagName = lname(child);
    
    if (tagName === 'li' || tagName === 'la') {
      const label = extractListItemLabel(child);
      const itemChildren = parseContentNodes(childrenOf(child), parentId);
      
      children.push({
        type: 'listItem',
        label,
        children: itemChildren
      });
    } else if (tagName === 'dt') {
      // For definition lists (DL), combine DT and the following DD into one list item
      const label = extractTextContent(childrenOf(child)).trim();
      let itemChildren: ContentNode[] = [];
      
      // Look for the next DD element
      if (i + 1 < nodeChildren.length && lname(nodeChildren[i + 1]) === 'dd') {
        const ddNode = nodeChildren[i + 1];

        // Parse DD content which may contain nested lists
        itemChildren = parseContentNodes(childrenOf(ddNode), generateListItemId(label, parentId));
        i++; // Skip the DD node since we processed it
      }
      
      const listItemNode : ListItemNode = {
        type: 'listItem',
        label,
        children: itemChildren
      };

      children.push(listItemNode);
    }
  }
  
  return {
    type: 'list',
    listType,
    children
  };
}

/**
 * Parse tables with full structure
 */
function parseTable(tableNode: PONode): TableNode {
  const attrs = attrsOf(tableNode);
  const meta = {
    ...(attrs.frame && { frame: attrs.frame }),
    ...(attrs.pgwide && { pgwide: attrs.pgwide })
  };
  
  const children: TableGroupNode[] = [];
  
  // Look for tgroup elements
  for (const child of childrenOf(tableNode)) {
    const tagName = lname(child);
    
    if (tagName === 'tgroup') {
      const tgroupAttrs = attrsOf(child);
      const cols = parseInt(tgroupAttrs.cols || '1', 10);
      
      const tgroupChildren: (TableHeaderNode | TableBodyNode)[] = [];
      
      for (const tgChild of childrenOf(child)) {
        const tgTagName = lname(tgChild);
        
        if (tgTagName === 'thead') {
          tgroupChildren.push({
            type: 'tableHeader',
            children: parseTableRows(childrenOf(tgChild))
          });
        } else if (tgTagName === 'tbody') {
          tgroupChildren.push({
            type: 'tableBody', 
            children: parseTableRows(childrenOf(tgChild))
          });
        }
      }
      
      children.push({
        type: 'tableGroup',
        cols,
        children: tgroupChildren
      });
    }
  }
  
  return {
    type: 'table',
    meta: Object.keys(meta).length > 0 ? meta : undefined,
    children
  };
}

/**
 * Parse table rows
 */
function parseTableRows(nodes: PONode[]): TableRowNode[] {
  const rows: TableRowNode[] = [];
  
  for (const node of nodes) {
    if (lname(node) === 'row') {
      const cells: TableCellNode[] = [];
      
      for (const cellNode of childrenOf(node)) {
        if (lname(cellNode) === 'entry') {
          const cellAttrs = attrsOf(cellNode);
          cells.push({
            type: 'tableCell',
            colname: cellAttrs.colname,
            children: parseContentNodes(childrenOf(cellNode))
          });
        }
      }
      
      rows.push({
        type: 'tableRow',
        children: cells
      });
    }
  }
  
  return rows;
}

/* ===================== Structure Parsing ===================== */

/**
 * Parse structure nodes (chapters, sections, etc.)
 */
function parseStructure(norm: PONode): { node: StructureNode; level: number } | null {
  const meta = firstChild(norm, 'metadaten');
  if (!meta) return null;
  
  const gl = firstChild(meta, 'gliederungseinheit');
  if (!gl) return null;
  
  const codeN = firstChild(gl, 'gliederungskennzahl');
  const labelN = firstChild(gl, 'gliederungsbez');
  const titleN = firstChild(gl, 'gliederungstitel');
  
  const id = codeN ? textDeep(codeN).trim() : '';
  const label = labelN ? textDeep(labelN).trim() : '';
  const title = titleN ? textDeep(titleN).trim() : '';
  
  if (!id || !label) return null;
  
  const level = levelFromCode(id);
  
  return {
    node: {
      type: 'structure',
      meta: {
        id,
        label,
        title
      },
      children: []
    },
    level
  };
}

/**
 * Parse section nodes (§§, Articles, etc.)
 */
function parseSection(norm: PONode): SectionNode | null {
  const meta = firstChild(norm, 'metadaten');
  if (!meta) return null;
  
  const enbezN = firstChild(meta, 'enbez');
  if (!enbezN) return null;
  
  const enbez = textDeep(enbezN).trim();
  const titleN = firstChild(meta, 'titel');
  const title = titleN ? textDeep(titleN).trim() : '';
  const doknr = attrsOf(norm).doknr;
  
  const normalizedId = normalizeId(enbez);
  
  const section: SectionNode = {
    type: 'section',
    meta: {
      id: normalizedId,
      label: enbez,
      title,
      ...(doknr && { documentId: doknr })
    },
    children: []
  };
  
  // Parse content blocks
  const textdaten = allChildren(norm, 'textdaten');
  for (const textdatenEl of textdaten) {
    const textEl = firstChild(textdatenEl, 'text');
    if (textEl) {
      for (const contentEl of allChildren(textEl, 'content')) {
        for (const [i, child] of childrenOf(contentEl).entries()) {
          const tagName = lname(child);
          
          if (tagName === 'p') {
            // Each P element becomes a block
            const block: BlockNode = {
              type: 'block',
              children: parseContentNodes(childrenOf(child), `${normalizedId}.${i+1}`),
            };
            section.children.push(block);
          }
        }
      }
    }
  }
  
  return section;
}

/**
 * Extract document metadata from norm elements
 */
function extractDocumentMetadata(norms: PONode[]): DocumentMeta {
  const meta: Partial<DocumentMeta> = {
    notes: []
  };
  
  for (const norm of norms) {
    const metaEl = firstChild(norm, 'metadaten');
    if (!metaEl) continue;
    
    // Extract various metadata fields
    if (!meta.legalAbbr) {
      const jurabk = firstChild(metaEl, 'jurabk');
      if (jurabk) {
        const jurabkText = textDeep(jurabk).trim();
        meta.legalAbbr = jurabkText;
        // Also try to extract officialAbbr by removing year suffix
        if (!meta.officialAbbr) {
          meta.officialAbbr = jurabkText.replace(/\s+\d{4}$/, '');
        }
      }
    }
    
    if (!meta.officialAbbr) {
      const amtabk = firstChild(metaEl, 'amtabk');
      if (amtabk) {
        meta.officialAbbr = textDeep(amtabk).trim();
      }
    }
    
    if (!meta.date) {
      const ausfDatum = firstChild(metaEl, 'ausfertigung-datum');
      if (ausfDatum) {
        meta.date = textDeep(ausfDatum).trim();
      }
    }
    
    if (!meta.citation) {
      const fundstelle = firstChild(metaEl, 'fundstelle');
      if (fundstelle) {
        const periodikum = firstChild(fundstelle, 'periodikum');
        const zitstelle = firstChild(fundstelle, 'zitstelle');
        
        if (periodikum && zitstelle) {
          meta.citation = {
            publication: textDeep(periodikum).trim(),
            reference: textDeep(zitstelle).trim()
          };
        }
      }
    }
    
    if (!meta.shortTitle) {
      const kurzue = firstChild(metaEl, 'kurzue');
      if (kurzue) {
        meta.shortTitle = textDeep(kurzue).trim();
      }
    }
    
    if (!meta.longTitle) {
      const langue = firstChild(metaEl, 'langue');
      if (langue) {
        meta.longTitle = textDeep(langue).trim();
      }
    }
    
    if (!meta.documentId) {
      const doknr = attrsOf(norm).doknr;
      if (doknr) {
        meta.documentId = doknr;
      }
    }
    
    // Collect notes
    const standkommentar = allChildren(metaEl, 'standkommentar');
    for (const sk of standkommentar) {
      const note = textDeep(sk).trim();
      if (note && !meta.notes!.includes(note)) {
        meta.notes!.push(note);
      }
    }
  }
  
  return meta as DocumentMeta;
}

/* ===================== Main Conversion Function ===================== */

/**
 * Convert German law XML to JSON following the specification
 */
function convert(xml: string): DocumentNode {
  const parsed = parser.parse(xml) as PONode[];
  
  // Collect all norm elements
  const norms: PONode[] = [];
  const collectNorms = (nodes: PONode[]) => {
    for (const node of nodes) {
      if (lname(node) === 'norm') {
        norms.push(node);
      }
      collectNorms(childrenOf(node));
    }
  };
  collectNorms(parsed);
  
  // Extract document metadata
  const documentMeta = extractDocumentMetadata(norms);
  
  // Initialize document
  const document: DocumentNode = {
    type: 'document',
    meta: documentMeta,
    children: []
  };
  
  // Build hierarchy using a stack approach
  const structureStack: StructureNode[] = [];
  
  for (const norm of norms) {
    // Try parsing as structure first
    const parsedStructure = parseStructure(norm);
    if (parsedStructure) {
      const { node, level } = parsedStructure;
      
      // Pop stack until we find the right parent level
      while (structureStack.length >= level) {
        structureStack.pop();
      }
      
      // Add to appropriate parent
      if (structureStack.length > 0) {
        structureStack[structureStack.length - 1].children.push(node);
      } else {
        document.children.push(node);
      }
      
      // Push onto stack
      structureStack.push(node);
      continue;
    }
    
    // Try parsing as section
    const section = parseSection(norm);
    if (section) {
      // Add to current structure or document
      if (structureStack.length > 0) {
        structureStack[structureStack.length - 1].children.push(section);
      } else {
        document.children.push(section);
      }
      continue;
    }
  }
  
  return document;
}

export { convert };