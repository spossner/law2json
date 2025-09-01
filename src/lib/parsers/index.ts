import { ParserRegistry } from './types.ts';
import { ParagraphParser } from './paragraph-parser.ts';
import { ListParser } from './list-parser.ts';
import { TableParser } from './table-parser.ts';

/**
 * Create and configure the default parser registry with all built-in parsers
 */
export function createParserRegistry(): ParserRegistry {
  const registry = new ParserRegistry();
  
  // Create parser instances
  const paragraphParser = new ParagraphParser();
  const listParser = new ListParser();
  const tableParser = new TableParser();
  
  // Resolve circular dependencies by providing cross-references
  paragraphParser.setNestedListParser((node, idPrefix) => listParser.parse(node, idPrefix));
  listParser.setNestedParagraphParser((node, idPrefix) => paragraphParser.parse(node, idPrefix));
  
  // Register all parsers
  registry.register(paragraphParser);
  registry.register(listParser);
  registry.register(tableParser);
  
  return registry;
}

// Export the configured registry as default
export const defaultParserRegistry = createParserRegistry();

// Re-export types and classes for external use
export { ParserRegistry } from './types.ts';
export type { Parser } from './types.ts';
export { ParagraphParser } from './paragraph-parser.ts';
export { ListParser } from './list-parser.ts';
export { TableParser } from './table-parser.ts';