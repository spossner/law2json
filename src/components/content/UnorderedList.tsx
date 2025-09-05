import { cn } from '../../lib/utils';
import type { ListNode } from '../../types';
import { ContentRenderer } from './ContentRenderer';

type OrderedListProps = {
  listElement: ListNode;
  contentId?: string;
  searchTerm?: string;
  onContentSelect?: (contentId: string) => void;
  selectedContentId?: string | null;
};

const UnorderedList = ({
  listElement,
  contentId,
  searchTerm,
  onContentSelect,
  selectedContentId,
}: OrderedListProps) => {
  return (
    <ul
      className={cn(
        'space-y-2 ml-4',
        listElement.meta?.listType === 'Bullet'
          ? 'list-disc list-inside'
          : listElement.meta?.listType === 'Dash'
            ? 'list-none'
            : 'list-disc list-inside'
      )}
    >
      {listElement.children.map((listItem, index) => (
        <li key={index} className="text-gray-900">
          {listElement.meta?.listType === 'Dash' && '– '}
          {listItem.children.map((child, childIndex) => (
            <ContentRenderer
              key={childIndex}
              element={child}
              searchTerm={searchTerm}
              parentPath={`${contentId}_li${index}`} // unordered lists have no unique id
              contentIndex={childIndex}
              simpleId={false}
              onContentSelect={onContentSelect}
              selectedContentId={selectedContentId}
            />
          ))}
        </li>
      ))}
    </ul>
  );
};
export default UnorderedList;
