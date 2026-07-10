// frontend/src/app/(app)/chat/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { MessageView } from '@/features/chat/components/MessageView';
import { Conversation, Message } from '@/shared/types/chatInterface';
import { chatService } from '@/features/chat/services/chatService';
import { useAuthStore } from '@/features/auth/store/useAuthStore'; // Use the auth store

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore(); // Get current user from auth store

  const currentUserId = user?.id || 'user-1'; // Fallback to mock user-1 if no authenticated user

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const fetchedConversations = await chatService.getConversations();
      setConversations(fetchedConversations);
      if (!selectedConversation && fetchedConversations.length > 0) {
        setSelectedConversation(fetchedConversations[0]);
      }
    } catch (err) {
      setError('Failed to fetch conversations.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const fetchedMessages = await chatService.getMessages(conversationId);
      setMessages(fetchedMessages);
    } catch (err) {
      setError('Failed to fetch messages.');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  if (loading) {
    return <div className="text-center py-8">Loading Chat...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] bg-card rounded-lg shadow-lg overflow-hidden">
      <div className="w-1/3 border-r border-border">
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id || null}
          onSelectConversation={id =>
            setSelectedConversation(conversations.find(c => c.id === id) || null)
          }
          currentUserId={currentUserId}
        />
      </div>
      <div className="flex-1">
        {selectedConversation ? (
          <MessageView
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={async content => {
              if (selectedConversation?.id) {
                await chatService.sendMessage(selectedConversation.id, content);
                fetchMessages(selectedConversation.id); // Refresh messages
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
