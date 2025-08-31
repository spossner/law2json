import React from 'react';
import type { OrderedListElement } from '../../types';
import { cn } from '../../lib/utils';
import { highlightText } from '../../lib/highlightText';

interface Props {
  element: OrderedListElement;
  className?: string;
  searchTerm?: string;
  parentPath?: string;
  onContentSelect?: (contentId: string) => void;
  selectedContentId?: string;
}

export function OrderedListRenderer({ element, className, searchTerm, parentPath, onContentSelect, selectedContentId }: Props) {
  const getListStyle = (listType: OrderedListElement['listType']) => {
    switch (listType) {
      case 'arabic':
        return 'list-decimal';
      case 'alpha':
        return 'list-[lower-alpha]';
      case 'Alpha':
        return 'list-[upper-alpha]';
      case 'roman':
        return 'list-[lower-roman]';
      case 'Roman':
        return 'list-[upper-roman]';
      case 'Dash':
        return 'list-none before:content-["–"] before:mr-2';
      case 'Bullet':
        return 'list-disc';
      case 'Symbol':
        return 'list-none';
      case 'None':
        return 'list-none';
      default:
        return 'list-decimal';
    }
  };

  const listStyle = getListStyle(element.listType);

  return (
    <ol className={cn(
      'ml-6 space-y-2',
      listStyle,
      element.listType === 'Symbol' && 'ml-0',
      className
    )}>
      {element.children.map((item, index) => {
        const displayText = searchTerm ? highlightText(item.text || 'List item content', searchTerm) : (item.text || 'List item content');
        const itemId = `${parentPath}_item_${index}`;
        const isSelected = selectedContentId === itemId;
        
        return (
          <li 
            key={index} 
            className={cn(
              "text-gray-900 leading-relaxed cursor-pointer rounded transition-colors p-1",
              "hover:bg-blue-50 hover:ring-1 hover:ring-blue-200",
              isSelected && "bg-blue-100 ring-1 ring-blue-300"
            )}
            onClick={() => onContentSelect?.(itemId)}
          >
            {element.listType === 'Symbol' && element.symbol && (
              <span className="mr-2">{element.symbol}</span>
            )}
            <span dangerouslySetInnerHTML={{ __html: displayText }} />
          </li>
        );
      })}
    </ol>
  );
}