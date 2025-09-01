import type { TextRun, ListNode, TableNode, ParagraphNode, SelectableElement } from '../../types';
import { cn } from '../../lib/utils';
import { highlightText } from '../../lib/highlightText';
import { Children } from 'react';

interface Props {
  element: any; // Can be TextRun, ListNode, TableNode, ParagraphNode, or SelectableElement
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
  
  const contentId = (element as any).id || (simpleId ? parentPath : `${parentPath}-${contentIndex}`);
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
      const textElement = element as TextRun;
      const highlightedText = searchTerm
        ? highlightText(textElement.md, searchTerm)
        : textElement.md;
      return (
        <div
          className={cn(
            'prose prose-lg max-w-none leading-relaxed',
            baseStyles,
            hoverStyles,
            selectedStyles,
            className
          )}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
      );

    // Handle ListNode
    case 'list':
      const listElement = element as ListNode;
      
      // Determine if it's an ordered list based on DTD listType
      const isOrderedList = ['arabic', 'alpha', 'Alpha', 'a-alpha', 'a3-alpha', 'roman', 'Roman'].includes(listElement.listType);
      
      // console.log('List rendering:', { 
      //   listType: listElement.listType, 
      //   isOrderedList, 
      //   element: listElement 
      // });
      
      return (
        <div className={cn('my-4', baseStyles, className)} onClick={handleClick}>
          {isOrderedList ? (
            <ol className="list-none list-inside space-y-2">
              {listElement.children.map((listItem, index) => (
                <li key={index} className="text-gray-900 flex gap-2">
                  {listItem.label && <span className="font-medium min-w-fit">{listItem.label}</span>}
                  <div className="flex-1">
                    {listItem.children.map((child, childIndex) => (
                      <ContentRenderer
                        key={childIndex}
                        element={child}
                        searchTerm={searchTerm}
                        parentPath={`${listItem.id}`}
                        simpleId={true}
                        contentIndex={childIndex}
                        onContentSelect={onContentSelect}
                        selectedContentId={selectedContentId}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ul
              className={cn(
                'space-y-2 ml-4',
                listElement.listType === 'Bullet'
                  ? 'list-disc list-inside'
                  : listElement.listType === 'Dash'
                    ? 'list-none'
                    : 'list-disc list-inside'
              )}
            >
              {listElement.children.map((listItem, index) => (
                <li key={index} className="text-gray-900">
                  {listElement.listType === 'Dash' && '– '}
                  {listItem.children.map((child, childIndex) => (
                    <ContentRenderer
                      key={childIndex}
                      element={child}
                      searchTerm={searchTerm}
                      parentPath={`${contentId}_li${index}`}
                      contentIndex={childIndex}
                      simpleId={false}
                      onContentSelect={onContentSelect}
                      selectedContentId={selectedContentId}
                    />
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    // Handle TableNode
    case 'table':
      const tableElement = element as TableNode;
      return (
        <div
          className={cn('overflow-x-auto my-4', baseStyles, hoverStyles, selectedStyles, className)}
          onClick={handleClick}
        >
          <table className="min-w-full border-collapse border border-gray-300">
            {tableElement.headers && (
              <thead className="bg-gray-50">
                <tr>
                  {tableElement.headers.map((header, headerIndex) => (
                    <th 
                      key={headerIndex} 
                      className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900"
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: searchTerm ? highlightText(header, searchTerm) : header,
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableElement.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: searchTerm ? highlightText(cell, searchTerm) : cell,
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
      const paragraphElement = element as ParagraphNode;
      return (
        <div className={cn('my-3 flex gap-2', baseStyles, className)} onClick={handleClick}>
          {paragraphElement.label && (
            <span className="text-gray-900">{paragraphElement.label}</span>
          )}
          <div className="space-y-2">
            {paragraphElement.children.map((child, index) => (
              <ContentRenderer
                key={index}
                element={child}
                searchTerm={searchTerm}
                parentPath={contentId}
                contentIndex={index}
                simpleId={paragraphElement.children.length === 1} // If only one child, use simpleId
                onContentSelect={onContentSelect}
                selectedContentId={selectedContentId}
              />
            ))}
          </div>
        </div>
      );

    // Handle SelectableElement (outline, article, section) that appear as children
    case 'outline':
    case 'article':
    case 'section':
      const selectableElement = element as SelectableElement;
      return (
        <div
          className={cn(
            'my-4 border-l-4 border-blue-200 pl-4',
            baseStyles,
            hoverStyles,
            selectedStyles,
            className
          )}
          onClick={handleClick}
        >
          <h3 className="font-semibold text-lg text-blue-800 mb-2">
            {(selectableElement as any).label} {(selectableElement as any).title}
          </h3>
          <div className="space-y-3">
            {selectableElement.children.map((child, index) => (
              <ContentRenderer
                key={index}
                element={child}
                searchTerm={searchTerm}
                parentPath={contentId}
                contentIndex={index}
                simpleId={false}
                onContentSelect={onContentSelect}
                selectedContentId={selectedContentId}
              />
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className="text-red-500 text-sm p-2 border border-red-200 rounded">
          Unknown element type: {element.type}
          <pre className="mt-2 text-xs">{JSON.stringify(element, null, 2)}</pre>
        </div>
      );
  }
}
