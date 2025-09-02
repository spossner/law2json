import type {
  TableCell,
  RenderableElement,
} from '../../types';
import { cn } from '../../lib/utils';
import OrderedList from './OrderedList';
import { FormattedTextRenderer } from './FormattedTextRenderer';
import { isOrderedListType } from './utils';
import UnorderedList from './UnorderedList';

interface Props {
  element: RenderableElement;
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
    // Handle TextRun (markdown content)
    case 'md':
      return (
        <FormattedTextRenderer
          textElement={element}
          className={cn(baseStyles, hoverStyles, selectedStyles, className)}
          searchTerm={searchTerm}
          handleClick={handleClick}
        />
      );

    // Handle ListNode
    case 'list':
      return (
        <div className={cn('my-4', baseStyles, className)} onClick={handleClick}>
          {isOrderedListType(element.listType) ? (
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
            {element.headers && (
              <thead className="bg-gray-50">
                <tr>
                  {element.headers.map((header, headerIndex) => (
                    <th
                      key={headerIndex}
                      colSpan={getColspan(header)}
                      className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900"
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderCell(header, searchTerm),
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {element.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      colSpan={getColspan(cell)}
                      className="border border-gray-300 px-4 py-2"
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderCell(cell, searchTerm),
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    // Handle ParagraphNode
    case 'p':
      return (
        <div className={cn('my-3 flex gap-2', baseStyles, className)} onClick={handleClick}>
          {element.label && (
            <span className="text-gray-900">{element.label}</span>
          )}
          <div className="space-y-2">
            {element.children.map((child, index) => (
              <ContentRenderer
                key={index}
                element={child}
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
      const isInline = element.position === 'inline';
      const alignmentClass =
        element.align === 'center'
          ? 'mx-auto'
          : element.align === 'right'
            ? 'ml-auto'
            : element.align === 'left'
              ? 'mr-auto'
              : 'mx-auto'; // default to center

      return (
        <div
          className={cn(
            'my-2',
            isInline ? 'inline-block' : 'block',
            alignmentClass,
            baseStyles,
            hoverStyles,
            selectedStyles,
            className
          )}
          onClick={handleClick}
        >
          <img
            src={`/law/${element.src}`} // Adjust path as needed
            alt={element.alt || 'Mathematical formula'}
            width={element.width}
            height={element.height}
            className={cn('max-w-full h-auto', isInline ? 'inline' : 'block', alignmentClass)}
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
