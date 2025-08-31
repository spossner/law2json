import React, { useState } from 'react';
import type { StructuralElement, ContentElement } from '../../types';
import { ContentRenderer } from '../content';
import { cn } from '../../lib/utils';

interface Props {
  element: StructuralElement;
  level?: number;
  onSelect?: (element: StructuralElement) => void;
  isSelected?: boolean;
}

export function StructuralElementRenderer({ 
  element, 
  level = 0, 
  onSelect, 
  isSelected = false 
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed

  const handleToggle = () => {
    if (element.type === 'chapter' || element.type === 'section') {
      setIsExpanded(!isExpanded);
    } else if (element.type === 'paragraph' || element.type === 'subparagraph') {
      onSelect?.(element);
    }
  };

  const hasStructuralChildren = element.children.some(
    child => 'type' in child && ['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
  );

  const structuralChildren = element.children.filter(
    child => 'type' in child && ['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
  ) as StructuralElement[];

  const contentChildren = element.children.filter(
    child => 'type' in child && !['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
  ) as ContentElement[];

  const getElementStyles = () => {
    const baseStyles = 'cursor-pointer transition-colors duration-150 border-l-4 border-transparent hover:border-blue-300 hover:bg-blue-50';
    
    switch (element.type) {
      case 'chapter':
        return cn(
          baseStyles,
          'text-lg font-bold py-3 px-4 bg-gray-50 border-b border-gray-200',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      case 'section':
        return cn(
          baseStyles,
          'text-base font-semibold py-2 px-6 bg-gray-25',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      case 'paragraph':
        return cn(
          baseStyles,
          'text-sm py-2 px-8',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      case 'subparagraph':
        return cn(
          baseStyles,
          'text-sm py-1 px-10 text-gray-700',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      default:
        return baseStyles;
    }
  };

  const renderExpandIcon = () => {
    if (!hasStructuralChildren) return <span className="w-4" />;
    
    return (
      <span className={cn(
        'w-4 h-4 flex items-center justify-center text-gray-400 transition-transform duration-150',
        isExpanded && 'rotate-90'
      )}>
        ▶
      </span>
    );
  };

  return (
    <div className="w-full">
      <div 
        className={getElementStyles()}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          {renderExpandIcon()}
          <span className="font-mono text-blue-600 min-w-fit">
            {element.number}
          </span>
          <span className="flex-1 truncate">
            {element.title}
          </span>
        </div>
      </div>
      
      {/* Structural children (nested structure) */}
      {isExpanded && hasStructuralChildren && (
        <div className="ml-0">
          {structuralChildren.map((child) => (
            <StructuralElementRenderer
              key={child.id}
              element={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={isSelected}
            />
          ))}
        </div>
      )}
      
      {/* No content rendering in sidebar - content shown in main area */}
    </div>
  );
}