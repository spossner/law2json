import React from 'react';
import type { ContentElement } from '../../types';
import { TextRenderer } from './TextRenderer';
import { FormattedTextRenderer } from './FormattedTextRenderer';
import { OrderedListRenderer } from './OrderedListRenderer';
import { ImageRenderer } from './ImageRenderer';
import { cn } from '../../lib/utils';
import { highlightText } from '../../lib/highlightText';

interface Props {
  element: ContentElement;
  className?: string;
  searchTerm?: string;
  parentPath: string; // Hierarchical path like "K4_A1_P20_S2"
  contentIndex: number; // Index within the content array
  onContentSelect?: (contentId: string) => void;
  selectedContentId?: string | null;
}

export function ContentRenderer({ 
  element, 
  className, 
  searchTerm, 
  parentPath, 
  contentIndex, 
  onContentSelect, 
  selectedContentId 
}: Props) {
  // Use hierarchical ID from JSON or fallback to calculated ID
  const contentId = element.id || `${parentPath}_${element.type}_${contentIndex}`;
  const isSelected = selectedContentId === contentId;
  
  const handleClick = () => {
    onContentSelect?.(contentId);
  };

  const baseStyles = "cursor-pointer rounded transition-colors";
  const hoverStyles = "hover:bg-blue-50 hover:ring-1 hover:ring-blue-200";
  const selectedStyles = isSelected ? "bg-blue-100 ring-1 ring-blue-300" : "";
  switch (element.type) {
    case 'text':
      return (
        <span 
          className={cn(baseStyles, hoverStyles, selectedStyles, "inline-block")} 
          onClick={handleClick}
        >
          <TextRenderer element={element} searchTerm={searchTerm} />
        </span>
      );
      
    case 'formatted_text':
      return (
        <span 
          className={cn(baseStyles, hoverStyles, selectedStyles, "inline-block")} 
          onClick={handleClick}
        >
          <FormattedTextRenderer element={element} className={className} searchTerm={searchTerm} />
        </span>
      );
      
    case 'line_break':
      return <br />;
      
    case 'preformatted':
      const preformattedText = searchTerm ? highlightText(element.text, searchTerm) : element.text;
      return (
        <pre 
          className={cn(
            'bg-gray-50 border border-gray-200 rounded p-3 text-sm font-mono whitespace-pre-wrap overflow-x-auto my-2',
            baseStyles, hoverStyles, selectedStyles,
            className
          )}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: preformattedText }}
        />
      );
      
    case 'comment':
      const commentStyles = {
        'Stand': 'bg-blue-50 border-blue-200 text-blue-800',
        'Stand-Hinweis': 'bg-blue-50 border-blue-200 text-blue-800', 
        'Hinweis': 'bg-yellow-50 border-yellow-200 text-yellow-800',
        'Fundstelle': 'bg-green-50 border-green-200 text-green-800',
        'Verarbeitung': 'bg-purple-50 border-purple-200 text-purple-800'
      } as const;
      
      return (
        <div 
          className={cn(
            'border rounded p-3 text-sm my-2',
            commentStyles[element.commentType] || commentStyles.Hinweis,
            baseStyles, hoverStyles, selectedStyles,
            className
          )}
          onClick={handleClick}
        >
          <strong className="text-xs uppercase tracking-wide opacity-75">
            {element.commentType}:
          </strong>
          <div 
            className="mt-1"
            dangerouslySetInnerHTML={{ 
              __html: searchTerm ? highlightText(element.text, searchTerm) : element.text 
            }}
          />
        </div>
      );
      
    case 'ordered_list':
      return (
        <OrderedListRenderer 
          element={element} 
          className={className} 
          searchTerm={searchTerm}
          parentPath={contentId} // Pass our content ID as parent for list items
          onContentSelect={onContentSelect}
          selectedContentId={selectedContentId}
        />
      );
      
    case 'image':
      return (
        <div 
          className={cn(baseStyles, hoverStyles, selectedStyles, "inline-block")}
          onClick={handleClick}
        >
          <ImageRenderer element={element} className={className} />
        </div>
      );
      
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
                  {element.headers.map((header, index) => (
                    <th key={index} className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {element.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                      {typeof cell === 'string' ? cell : JSON.stringify(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      
    case 'list_item':
      // This should normally be handled by OrderedListRenderer
      return (
        <li 
          className={cn("text-gray-900", baseStyles, hoverStyles, selectedStyles)}
          onClick={handleClick}
        >
          {element.text || 'List item'}
        </li>
      );
      
    default:
      return <div className="text-red-500 text-sm">Unknown element type</div>;
  }
}