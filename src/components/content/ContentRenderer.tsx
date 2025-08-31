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
}

export function ContentRenderer({ element, className, searchTerm }: Props) {
  switch (element.type) {
    case 'text':
      return <TextRenderer element={element} searchTerm={searchTerm} />;
      
    case 'formatted_text':
      return <FormattedTextRenderer element={element} className={className} searchTerm={searchTerm} />;
      
    case 'line_break':
      return <br />;
      
    case 'preformatted':
      const preformattedText = searchTerm ? highlightText(element.text, searchTerm) : element.text;
      return (
        <pre 
          className={cn(
            'bg-gray-50 border border-gray-200 rounded p-3 text-sm font-mono whitespace-pre-wrap overflow-x-auto my-2',
            className
          )}
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
        <div className={cn(
          'border rounded p-3 text-sm my-2',
          commentStyles[element.commentType] || commentStyles.Hinweis,
          className
        )}>
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
      return <OrderedListRenderer element={element} className={className} searchTerm={searchTerm} />;
      
    case 'image':
      return <ImageRenderer element={element} className={className} />;
      
    case 'table':
      return (
        <div className={cn('overflow-x-auto my-4', className)}>
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
        <li className="text-gray-900">
          {element.text || 'List item'}
        </li>
      );
      
    default:
      return <div className="text-red-500 text-sm">Unknown element type</div>;
  }
}