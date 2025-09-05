import { useState } from 'react';
import type { SelectableNode } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: SelectableNode;
  level?: number;
  onSelect?: (element: SelectableNode) => void;
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
    if (element.type === 'structure') {
      setIsExpanded(!isExpanded);
    }
    // Selectable leaf elements that should be selected
    else if (element.type === 'section' || element.type === 'block') {
      onSelect?.(element);
    }
  };

  // Check if element has navigable children (with IDs)
  const hasNavigableChildren =
    'children' in element &&
    element.children &&
    element.children.some(child => child.id !== undefined);

  const navigableChildren =
    'children' in element && element.children
      ? (element.children.filter(child => child.id !== undefined) as SelectableNode[])
      : [];

  // Remove contentChildren as it's not used

  const getElementStyles = () => {
    const baseStyles =
      'cursor-pointer transition-colors duration-150 border-l-4 border-transparent hover:border-blue-300 hover:bg-blue-50';

    switch (element.type) {
      case 'structure':
        return cn(
          baseStyles,
          'text-lg font-bold py-3 px-4 bg-gray-50 border-b border-gray-200',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      case 'section':
      case 'block':
        return cn(
          baseStyles,
          'text-sm py-2 px-8 font-medium',
          isSelected && 'bg-blue-100 border-l-blue-500'
        );
      default:
        return baseStyles;
    }
  };

  const renderExpandIcon = () => {
    // Only show expand arrows for structure containers, not leaf elements
    if (element.type !== 'structure') {
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
          <span className="flex-1 truncate">{element.text}</span>
        </div>
      </div>

      {/* Navigable children (nested structure) */}
      {isExpanded && hasNavigableChildren && (
        <div className="ml-0">
          {navigableChildren.map(child => (
            <StructuralElementRenderer
              key={child.id}
              element={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={selectedElementId === child.id}
              selectedElementId={selectedElementId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
