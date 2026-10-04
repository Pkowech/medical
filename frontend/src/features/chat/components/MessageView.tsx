import React, { useState, useRef, useEffect } from 'react';
import { Message } from '@/shared/types/chatInterface';
import { ArrowLeft, Send } from 'lucide-react';

interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
  conversationTitle?: string;
  onBack?: () => void;
}

export const MessageView: React.FC<MessageViewProps> = ({
  messages,
  onSendMessage,
  currentUserId,
  conversationTitle,
  onBack,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white shadow-md">
      {onBack && (
        <div className="flex min-w-0 items-center gap-3 border-b border-gray-200 px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {conversationTitle && (
            <h2 className="min-w-0 truncate font-semibold text-gray-900">
              {conversationTitle}
            </h2>
          )}
        </div>
      )}
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex min-w-0 ${message.sender.id === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] break-words rounded-lg px-3 py-2 sm:max-w-[75%] sm:px-4 lg:max-w-md ${
                message.sender.id === currentUserId
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                {message.content}
              </p>
              <span className="text-xs opacity-75 mt-1 block">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 items-center gap-2 border-t border-gray-200 p-3 sm:p-4"
      >
        <input
          type="text"
          className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message..."
          aria-label="Type your message"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};
