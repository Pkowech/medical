import React from 'react';
import { Conversation } from '@/shared/types/chatInterface';

interface ConversationListProps {
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  currentUserId: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onSelectConversation,
  selectedConversationId,
}) => {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col bg-muted">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-muted-foreground sm:text-xl">Conversations</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-4 text-muted-foreground text-center">No conversations yet.</p>
        ) : (
          conversations.map(conversation => (
            <button
              key={conversation.id}
              type="button"
              className={`flex w-full min-w-0 items-center gap-3 p-4 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${selectedConversationId === conversation.id
                  ? 'bg-blue-100 border-l-4 border-blue-500'
                  : ''
                }`}
              onClick={() => onSelectConversation(conversation.id)}
              aria-current={selectedConversationId === conversation.id ? 'true' : undefined}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-400 font-bold text-white">
                {conversation.participants[0] ? conversation.participants[0].name[0].toUpperCase() : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-muted-foreground">
                  {conversation.participants.map(p => p.name).join(', ')}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(conversation.lastMessage?.timestamp || conversation.updatedAt).toLocaleDateString()}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
