import React from 'react';
import type { OrderedListElement } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: OrderedListElement;
  className?: string;
}

export function OrderedListRenderer({ element, className }: Props) {
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
      {element.children.map((item, index) => (
        <li key={index} className="text-gray-900 leading-relaxed">
          {element.listType === 'Symbol' && element.symbol && (
            <span className="mr-2">{element.symbol}</span>
          )}
          {item.text || 'List item content'}
        </li>
      ))}
    </ol>
  );
}