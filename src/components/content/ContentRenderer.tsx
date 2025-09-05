import type { Node, TextNode } from '../../types';
import { cn } from '../../lib/utils';
import OrderedList from './OrderedList';
import { FormattedTextRenderer } from './FormattedTextRenderer';
import { alignmentClass, isOrderedListType } from './utils';
import UnorderedList from './UnorderedList';

interface Props {
  element: Node;
  className?: string;
  searchTerm?: string;
  parentPath: string; // Hierarchical path like "K4_A1_P20_S2"
  contentIndex: number; // Index within the content array
  simpleId: boolean; // Whether to use simple IDs or appending contextIndex if not explicit ID was set
  onContentSelect?: (contentId: string) => void;
  selectedContentId?: string | null;
}

export function ContentRenderer({
  element,
  className,
  searchTerm,
  parentPath,
  contentIndex,
  simpleId,
  onContentSelect,
  selectedContentId,
}: Props) {
  // Use hierarchical ID from JSON or fallback to calculated ID

  const contentId = element.id || (simpleId ? parentPath : `${parentPath}-${contentIndex}`);
  const isSelected = selectedContentId === contentId;
  // console.log("rendering", element, element.id, parentPath, element.type,contentIndex," --> ",contentId, isSelected);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContentSelect?.(contentId);
  };

  const baseStyles = 'cursor-pointer rounded transition-colors';
  const hoverStyles = 'hover:bg-blue-50 hover:ring-1 hover:ring-blue-200';
  const selectedStyles = isSelected ? 'bg-blue-100 ring-1 ring-blue-300' : '';

  switch (element.type) {
    // Handle TextNode (text content)
    case 'text':
      return (
        <FormattedTextRenderer
          textElement={element as TextNode}
          className={cn(baseStyles, hoverStyles, selectedStyles, className)}
          searchTerm={searchTerm}
          handleClick={handleClick}
        />
      );

    // Handle ListNode
    case 'list':
      return (
        <div className={cn('my-4', baseStyles, className)} onClick={handleClick}>
          {isOrderedListType(element.meta.listType) ? (
            <OrderedList
              listElement={element}
              searchTerm={searchTerm}
              onContentSelect={onContentSelect}
              selectedContentId={selectedContentId}
            />
          ) : (
            <UnorderedList
              listElement={element}
              searchTerm={searchTerm}
              onContentSelect={onContentSelect}
              selectedContentId={selectedContentId}
            />
          )}
        </div>
      );

    // Handle TableNode
    case 'table':
      return (
        <div
          className={cn('overflow-x-auto my-4', baseStyles, hoverStyles, selectedStyles, className)}
          onClick={handleClick}
        >
          <table className="min-w-full border-collapse border border-gray-300">
            {/* Table headers will be handled through table structure */}
            <tbody>
              {/* Table rows will be handled through table structure */}
              {element.children.map((child, index) => (
                <ContentRenderer
                  key={index}
                  element={child as Node}
                  searchTerm={searchTerm}
                  parentPath={contentId}
                  contentIndex={index}
                  simpleId={false}
                  onContentSelect={onContentSelect}
                  selectedContentId={selectedContentId}
                />
              ))}
            </tbody>
          </table>
        </div>
      );

    // Handle BlockNode
    case 'block':
      return (
        <div className={cn('my-3', baseStyles, className)} onClick={handleClick}>
          <div className="space-y-2">
            {element.children.map((child, index) => (
              <ContentRenderer
                key={index}
                element={child as Node}
                searchTerm={searchTerm}
                parentPath={contentId}
                contentIndex={index}
                simpleId={element.children.length === 1} // If only one child, use simpleId
                onContentSelect={onContentSelect}
                selectedContentId={selectedContentId}
              />
            ))}
          </div>
        </div>
      );

    // Handle ImageNode
    case 'image':
      return (
        <div
          className={cn(
            'my-2',
            alignmentClass(element.meta.align),
            baseStyles,
            hoverStyles,
            selectedStyles,
            className
          )}
          onClick={handleClick}
        >
          <img
            src={`/law/${element.meta?.src}`} // Adjust path as needed
            alt={element.meta?.alt || 'Mathematical formula'}
            width={element.meta?.width}
            height={element.meta?.height}
            className={cn('max-w-full h-auto', alignmentClass(element.meta.align))}
          />
        </div>
      );

    default:
      return (
        <div className="text-red-500 text-sm p-2 border border-red-200 rounded">
          Unknown element type
          <pre className="mt-2 text-xs">{JSON.stringify(element, null, 2)}</pre>
        </div>
      );
  }
}
