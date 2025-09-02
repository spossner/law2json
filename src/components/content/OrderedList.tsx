import type { ListNode } from '../../types';
import { ContentRenderer } from './ContentRenderer';

type OrderedListProps = {
  listElement: ListNode;
  searchTerm?: string;
  onContentSelect?: (contentId: string) => void;
  selectedContentId?: string | null;
};

const OrderedList = ({
  listElement,
  searchTerm,
  onContentSelect,
  selectedContentId,
}: OrderedListProps) => {
  return (
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
  );
};
export default OrderedList;
