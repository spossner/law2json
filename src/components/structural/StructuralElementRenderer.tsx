import { useState } from 'react';
import type { SelectableElement } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: SelectableElement;
  level?: number;
  onSelect?: (element: SelectableElement) => void;
  isSelected?: boolean;
  selectedElementId?: string; // Pass selected element ID for nested comparison
}

export function StructuralElementRenderer({
  element,
  level = 0,
  onSelect,
  isSelected = false,
  selectedElementId,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed

  const handleToggle = () => {
    // Container elements that should expand/collapse
    if (element.type === 'outline') {
      setIsExpanded(!isExpanded);
    }
    // Selectable leaf elements that should be selected
    else if (element.type === 'article' || element.type === 'section' || element.type === 'p') {
      onSelect?.(element);
    }
  };

  // Check if element has navigable children (with IDs)
  const hasNavigableChildren =
    'children' in element &&
    element.children &&
    element.children.some(child => 'id' in child && (child as any).id !== undefined);

  const navigableChildren =
    'children' in element && element.children
      ? (element.children.filter(
          child => 'id' in child && (child as any).id !== undefined
        ) as SelectableElement[])
      : [];

  // Remove contentChildren as it's not used

  const getElementStyles = () => {
    const baseStyles =
      'cursor-pointer transition-colors duration-150 border-l-4 border-transparent hover:border-blue-300 hover:bg-blue-50';

    switch (element.type) {
      case 'outline':
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
      case 'article':
        return cn(
          baseStyles,
          'text-sm py-2 px-8 font-medium',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      case 'p':
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
    // Only show expand arrows for outline containers, not leaf elements
    if (element.type !== 'outline') {
      return <span className="w-4" />;
    }

    if (!hasNavigableChildren) return <span className="w-4" />;

    return (
      <span
        className={cn(
          'w-4 h-4 flex items-center justify-center text-gray-400 transition-transform duration-150',
          isExpanded && 'rotate-90'
        )}
      >
        ▶
      </span>
    );
  };

  return (
    <div className="w-full">
      <div className={getElementStyles()} onClick={handleToggle}>
        <div className="flex items-center gap-2">
          {renderExpandIcon()}
          <span className="font-mono text-blue-600 min-w-fit">{(element as any).label}</span>
          <span className="flex-1 truncate">{(element as any).title}</span>
        </div>
      </div>

      {/* Navigable children (nested structure) */}
      {isExpanded && hasNavigableChildren && (
        <div className="ml-0">
          {navigableChildren.map(child => (
            <StructuralElementRenderer
              key={(child as any).id}
              element={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={selectedElementId === (child as any).id}
              selectedElementId={selectedElementId}
            />
          ))}
        </div>
      )}

      {/* No content rendering in sidebar - content shown in main area */}
    </div>
  );
}
