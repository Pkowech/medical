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
    <div className="w-80 bg-gray-100 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Conversations</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No conversations yet.</p>
        ) : (
          conversations.map(conversation => (
            <div
              key={conversation.id}
              className={`flex items-center p-4 cursor-pointer hover:bg-gray-200 ${selectedConversationId === conversation.id
                  ? 'bg-blue-100 border-l-4 border-blue-500'
                  : ''
                }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold mr-3">
                {conversation.participants[0] ? conversation.participants[0].name[0].toUpperCase() : ''}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-800">
                  {conversation.participants.map(p => p.name).join(', ')}
                </h3>
                <p className="text-xs text-gray-500">
                  {new Date(conversation.lastMessage?.timestamp || conversation.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
