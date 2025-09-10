import type {
  BlockNode,
  ContentNode,
  DocumentNode,
  ImageNode,
  ListItemNode,
  ListNode,
  SectionNode,
  StructureNode,
  TableNode,
  TableRow,
  TableCell,
  TextNode,
} from '../types';

import {
    allChildren,
    attrsOf,
    childrenOf,
    firstChild,
    generateUID,
    isTextNode,
    levelFromCode,
    lname,
    parser,
    type PONode,
    textDeep,
    textOf,
} from './converter-utils.ts' /* ===================== Helper Functions ===================== */

/* ===================== Helper Functions ===================== */

/**
 * Normalize IDs by removing spaces but keeping special characters
 * Examples: "§ 44" → "§44", "Anlage 1" → "Anlage1"
 */
function normalizeId(enbez: string): string {
    return enbez.replace(/\s+/g, '')
}

/**
 * Normalize whitespace characters by replacing non-breaking spaces and other special spaces with regular spaces
 */
function normalizeWhitespace(text: string): string {
    return text
        .replace(/\u00A0/g, ' ')  // Non-breaking space (NBSP)
        .replace(/\u2007/g, ' ')  // Figure space
        .replace(/\u2009/g, ' ')  // Thin space
        .replace(/\u200A/g, ' ')  // Hair space
        .replace(/\u202F/g, ' ')  // Narrow no-break space
        .replace(/\u3000/g, ' ')  // Ideographic space
        .replace(/\s+/g, ' ')     // Collapse multiple spaces into one
}

/**
 * Extract text content with basic formatting preserved
 */
function extractTextContent(nodes: PONode[]): string {
    let result = ''

    const processNode = (node: PONode): void => {
        if (isTextNode(node)) {
            result += normalizeWhitespace(textOf(node))
            return
        }

        const tagName = lname(node)
        const children = childrenOf(node)

        switch (tagName) {
            case 'b':
                result += '**'
                children.forEach(processNode)
                result += '**'
                break
            case 'i':
                result += '*'
                children.forEach(processNode)
                result += '*'
                break
            case 'br':
                result += '\n'
                break
            case 'u':
            case 'sup':
            case 'sub':
            case 'small':
                result += `<${tagName}>`
                children.forEach(processNode)
                result += `</${tagName}>`
                break
            default:
                children.forEach(processNode)
        }
    }

    nodes.forEach(processNode)
    return result.trim()
}

/**
 * Determine list type based on XML attribute
 */
function determineListType(listNode: PONode): ListNode['meta']['listType'] {
    const attrs = attrsOf(listNode)
    return attrs.Type || 'arabic'
}

/**
 * Calculate colspan based on namest/nameend attributes and column names
 */
function calculateColspan(namest?: string, nameend?: string, columnNames: string[] = []): number {
  if (!namest || !nameend) {
    return 1;
  }
  
  const startIndex = columnNames.indexOf(namest);
  const endIndex = columnNames.indexOf(nameend);
  
  if (startIndex === -1 || endIndex === -1) {
    return 1;
  }
  
  return endIndex - startIndex + 1;
}

/**
 * Extract list item label (number/letter/bullet)
 * @TODO check if not the pure text content is alays good to use (-> custom symbols?)
 */
function extractListItemLabel(itemNode: PONode): string {
    const text = normalizeWhitespace(textDeep(itemNode))
    const match = text.match(/^(\d+\.|[a-zA-Z]+\)|[ivxIVX]+\)|-|\*)/)
    return match ? match[1] : ''
}

/* ===================== ID Generation Helpers ===================== */

/**
 * Generate ID for list items based on label
 * Extracts alphanumeric part from label: "a)" → "a", "1." → "1"
 * Returns "<parentId>.extracted"
 */
function generateListItemId(label: string, parentId?: string): string {
    // Extract alphanumeric characters from label
    const cleanLabel = label.replace(/[^a-zA-Z0-9]/g, '')
    if (cleanLabel) {
        return buildId(parentId, cleanLabel)
    }
    // Fallback for labels without alphanumeric content
    return buildId(parentId, label)
}

/* ===================== Content Parsing ===================== */

/**
 * Parse mixed content within blocks, handling text, lists, tables, etc.
 */
function parseContentNodes(nodes: PONode[], parentId?: string): ContentNode[] {
    const result: ContentNode[] = []
    let textBuffer: PONode[] = []

    const flushTextBuffer = () => {
        if (textBuffer.length > 0) {
            const content = extractTextContent(textBuffer)
            if (content.trim()) {
                const textNode: TextNode = {
                    type: 'text',
                    id: buildId(parentId, result.length),
                    text: content.trim(),
                    children: [],
                }

                result.push(textNode)
            }
            textBuffer = []
        }
    }

    for (const node of nodes) {
        if (isTextNode(node)) {
            textBuffer.push(node)
            continue
        }

        const tagName = lname(node)

        switch (tagName) {
            case 'dl':
            case 'ol':
            case 'ul': {
                flushTextBuffer()
                result.push(parseList(node, parentId))
                break
            }

            case 'table': {
                flushTextBuffer()
                result.push(parseTable(node, buildId(parentId, result.length)));
                break
            }

            case 'img': {
                flushTextBuffer()
                const attrs = attrsOf(node)
                const imageNode: ImageNode = {
                    type: 'image',
                    id: buildId(parentId, result.length),
                    meta: {
                        src: attrs.SRC || '',
                        ...(attrs.alt && { alt: attrs.alt }),
                        height: attrs.Height,
                        width: attrs.Width,
                        align: attrs.Align,
                        type: attrs.Type,
                    },
                    children: [],
                }

                result.push(imageNode)
                break
            }

            // LA elements (list articles) need special handling
            case 'la': {
                flushTextBuffer()
                // Parse LA content which may contain nested lists and text
                const laContent = parseContentNodes(childrenOf(node), parentId)
                result.push(...laContent)
                break
            }

            // Inline formatting elements go to text buffer
            case 'b':
            case 'i':
            case 'u':
            case 'sup':
            case 'sub':
            case 'small':
            case 'br':
                textBuffer.push(node)
                break

            default:
                // Unknown elements also go to text buffer
                textBuffer.push(node)
        }
    }

    flushTextBuffer()
    return result
}

/**
 * Parse table with head and body support
 */
function parseTable(tableNode: PONode, parentId?: string): TableNode {
    const children = childrenOf(tableNode)
    const tgroup = children.find(child => lname(child) === 'tgroup')
    const tableId = buildId(parentId, 't');
    
    if (!tgroup) {
        return {
            type: 'table',
            id: tableId,
            columnNames: [],
        }
    }

    const tgroupChildren = childrenOf(tgroup)
    
    // Extract column names from colspec elements
    const colspecs = tgroupChildren.filter(child => lname(child) === 'colspec')
    const columnNames = colspecs.map(colspec => {
        const attrs = attrsOf(colspec)
        return attrs.colname || `col${attrs.colnum || ''}`
    })

    // Parse thead
    const theadEl = tgroupChildren.find(child => lname(child) === 'thead')
    let head: TableNode['head']
    if (theadEl) {
        const theadRows = childrenOf(theadEl).filter(child => lname(child) === 'row')
        head = {
            rows: theadRows.map((rowNode, rowNo) => parseTableRow(rowNode, columnNames, buildId(tableId, "h", rowNo)))
        }
    }

    // Parse tbody
    const tbodyEl = tgroupChildren.find(child => lname(child) === 'tbody')
    let body: TableNode['body']
    if (tbodyEl) {
        const tbodyRows = childrenOf(tbodyEl).filter(child => lname(child) === 'row')
        body = {
            rows: tbodyRows.map((rowNode, rowNo) => parseTableRow(rowNode, columnNames, buildId(tableId, "b", rowNo)))
        }
    }

    return {
        type: 'table',
        id: tableId,
        columnNames,
        head,
        body,
    }
}

/**
 * Parse table row
 */
function parseTableRow(rowNode: PONode, columnNames: string[], parentId: string): TableRow {
    const attrs = attrsOf(rowNode)
    const entries = childrenOf(rowNode).filter(child => lname(child) === 'entry')
    
    const cells = entries.map((entryNode, colNo) => parseTableCell(entryNode, columnNames, buildId(parentId,colNo)))
    
    return {
        ...(attrs.valign && { valign: attrs.valign as 'top' | 'bottom' | 'middle' }),
        cells,
    }
}

/**
 * Parse table cell
 */
function parseTableCell(entryNode: PONode, columnNames: string[], parentId: string): TableCell {
    const attrs = attrsOf(entryNode)
    const entryChildren = childrenOf(entryNode)
    
    // Calculate colspan based on namest/nameend attributes
    const colspan = calculateColspan(attrs.namest, attrs.nameend, columnNames)
    
    // Parse cell content
    const content = parseContentNodes(entryChildren, parentId)
    
    return {
        ...(colspan > 1 && { colspan }),
        content,
    }
}

/**
 * Parse lists with proper nesting support
 */
function parseList(listNode: PONode, parentId?: string): ListNode {
    const listType = determineListType(listNode)
    const children: ListItemNode[] = []
    const nodeChildren = childrenOf(listNode)

    for (let i = 0; i < nodeChildren.length; i++) {
        const child = nodeChildren[i]
        const tagName = lname(child)

        if (tagName === 'li' || tagName === 'la') {
            const label = extractListItemLabel(child)
            const itemChildren = parseContentNodes(childrenOf(child), parentId)

            children.push({
                type: 'listItem',
                id: buildId(parentId || generateUID(), i),
                text: label,
                children: itemChildren,
            })
        } else if (tagName === 'dt') {
            // For definition lists (DL), combine DT and the following DD into one list item
            const label = extractTextContent(childrenOf(child)).trim()
            let itemChildren: ContentNode[] = []

            // Look for the next DD element
            if (
                i + 1 < nodeChildren.length &&
                lname(nodeChildren[i + 1]) === 'dd'
            ) {
                const ddNode = nodeChildren[i + 1]

                // Parse DD content which may contain nested lists
                itemChildren = parseContentNodes(
                    childrenOf(ddNode),
                    generateListItemId(label, parentId),
                )
                i++ // Skip the DD node since we processed it
            }

            const listItemNode: ListItemNode = {
                type: 'listItem',
                id: buildId(parentId || generateUID(), i),
                text: label,
                children: itemChildren,
            }

            children.push(listItemNode)
        }
    }

    return {
        type: 'list',
        id: parentId || generateUID(),
        meta: {
            listType,
        },
        children,
    }
}

/* ===================== Structure Parsing ===================== */

/**
 * Parse structure nodes (chapters, sections, etc.)
 */
function parseStructure(
    norm: PONode,
): { node: StructureNode; level: number } | null {
    const meta = firstChild(norm, 'metadaten')
    if (!meta) return null

    const gl = firstChild(meta, 'gliederungseinheit')
    if (!gl) return null

    const codeN = firstChild(gl, 'gliederungskennzahl')
    const labelN = firstChild(gl, 'gliederungsbez')
    const titleN = firstChild(gl, 'gliederungstitel')

    const id = codeN ? normalizeWhitespace(textDeep(codeN)) : ''
    const label = labelN ? normalizeWhitespace(textDeep(labelN)) : ''
    const title = titleN ? normalizeWhitespace(textDeep(titleN)) : ''

    if (!id || !label) return null

    const level = levelFromCode(id)

    return {
        node: {
            type: 'structure',
            id,
            text: title.length > 0 ? `${label} - ${title}` : label,
            children: [],
        },
        level,
    }
}

function buildId(...parts: unknown[]) {
    return parts
        .filter((part) => part !== null && part !== undefined && part !== '')
        .map((part) => String(part))
        .join('/')
}

/**
 * Parse section nodes (§§, Articles, etc.)
 */
function parseSection(norm: PONode, prefix?: string): SectionNode | null {
    const meta = firstChild(norm, 'metadaten')
    if (!meta) return null

    const enbezN = firstChild(meta, 'enbez')
    if (!enbezN) return null

    const enbez = normalizeWhitespace(textDeep(enbezN))
    const titleN = firstChild(meta, 'titel')
    const title = titleN ? normalizeWhitespace(textDeep(titleN)) : ''
    const doknr = attrsOf(norm).doknr

    const normalizedId = normalizeId(enbez)

    const section: SectionNode = {
        type: 'section',
        id: buildId(prefix, normalizedId),
        text: `${enbez} ${title}`.trim(),
        meta: {
            ...(doknr && { doknr }),
        },
        children: [],
    }

    // Parse content blocks
    const textdaten = allChildren(norm, 'textdaten')
    for (const textdatenEl of textdaten) {
        const textEl = firstChild(textdatenEl, 'text')
        if (textEl) {
            for (const contentEl of allChildren(textEl, 'content')) {
                const contentChildren = childrenOf(contentEl)
                let blockIndex = 1
                
                for (const child of contentChildren) {
                    const tagName = lname(child)

                    if (tagName === 'p') {
                        const blockId = buildId(prefix, normalizedId, blockIndex)
                        // Each P element becomes a block
                        const block: BlockNode = {
                            type: 'block',
                            id: blockId,
                            children: parseContentNodes(
                                childrenOf(child),
                                blockId,
                            ),
                        }
                        section.children.push(block)
                        blockIndex++
                    } else if (tagName === 'table') {
                        const blockId = buildId(prefix, normalizedId, blockIndex)
                        // Table becomes a block containing the table
                        const block: BlockNode = {
                            type: 'block',
                            id: blockId,
                            children: [parseTable(child, blockId)],
                        }
                        section.children.push(block)
                        blockIndex++
                    }
                    // Skip other elements like BR for now
                }
            }
        }
    }

    return section
}

/**
 * Extract document metadata from norm elements
 */
function extractDocumentMetadata(norms: PONode[]): DocumentNode['meta'] {
    const meta: Partial<DocumentNode['meta']> = {
        standkommentar: [],
    }

    for (const norm of norms) {
        const metaEl = firstChild(norm, 'metadaten')
        if (!metaEl) continue

        // Extract various metadata fields
        if (!meta.jurabk) {
            const jurabk = firstChild(metaEl, 'jurabk')
            if (jurabk) {
                const jurabkText = textDeep(jurabk)
                meta.jurabk = jurabkText
                // Also try to extract amtabk by removing year suffix
                // @todo sure we want to have that fallback?
                if (!meta.amtabk) {
                    meta.amtabk = jurabkText.replace(/\s+\d{4}$/, '')
                }
            }
        }

        if (!meta.amtabk) {
            const amtabk = firstChild(metaEl, 'amtabk')
            if (amtabk) {
                meta.amtabk = textDeep(amtabk)
            }
        }

        if (!meta["ausfertigung-datum"]) {
            const ausfDatum = firstChild(metaEl, 'ausfertigung-datum')
            if (ausfDatum) {
                meta["ausfertigung-datum"] = textDeep(ausfDatum)
            }
        }

        if (!meta.fundstelle) {
            const fundstelle = firstChild(metaEl, 'fundstelle')
            if (fundstelle) {
                const periodikum = firstChild(fundstelle, 'periodikum')
                const zitstelle = firstChild(fundstelle, 'zitstelle')

                if (periodikum && zitstelle) {
                    meta.fundstelle = {
                      periodikum: textDeep(periodikum),
                      zitstelle: textDeep(zitstelle),
                    }
                }
            }
        }

        if (!meta.kurzue) {
            const kurzue = firstChild(metaEl, 'kurzue')
            if (kurzue) {
                meta.kurzue = textDeep(kurzue)
            }
        }

        if (!meta.langue) {
            const langue = firstChild(metaEl, 'langue')
            if (langue) {
                meta.langue = textDeep(langue)
            }
        }

        if (!meta.doknr) {
            const doknr = attrsOf(norm).doknr
            if (doknr) {
                meta.doknr = doknr
            }
        }

        // Collect standkommentar
        const standkommentar = allChildren(metaEl, 'standkommentar')
        for (const sk of standkommentar) {
            const note = textDeep(sk)
            if (note && !meta.standkommentar!.includes(note)) {
                meta.standkommentar!.push(note)
            }
        }
    }

    return meta as DocumentNode['meta']
}

/* ===================== Main Conversion Function ===================== */

/**
 * Convert German law XML to JSON following the specification
 */
function convert(xml: string): DocumentNode {
    const parsed = parser.parse(xml) as PONode[]

    // Collect all norm elements
    const norms: PONode[] = []
    const collectNorms = (nodes: PONode[]) => {
        for (const node of nodes) {
            if (lname(node) === 'norm') {
                norms.push(node)
            }
            collectNorms(childrenOf(node))
        }
    }
    collectNorms(parsed)

    // Extract document metadata
    const documentMeta = extractDocumentMetadata(norms)

    // Initialize document
    const document: DocumentNode = {
        type: 'document',
        meta: documentMeta,
        children: [],
    }

    // Build hierarchy using a stack approach
    const structureStack: StructureNode[] = []

    for (const norm of norms) {
        // Try parsing as structure first
        const parsedStructure = parseStructure(norm)
        if (parsedStructure) {
            const { node, level } = parsedStructure

            // Pop stack until we find the right parent level
            while (structureStack.length >= level) {
                structureStack.pop()
            }

            // Add to appropriate parent
            if (structureStack.length > 0) {
                structureStack[structureStack.length - 1].children.push(node)
            } else {
                document.children.push(node)
            }

            // Push onto stack
            structureStack.push(node)
            continue
        }

        const lastElement = structureStack[structureStack.length - 1]

        // Try parsing as section
        const section = parseSection(norm, lastElement?.id)
        if (section) {
            // Add to current structure or document
            if (structureStack.length > 0) {
                lastElement.children.push(section)
            } else {
                document.children.push(section)
            }
            continue
        }
    }

    return document
}

export { convert }
