// frontend/src/app/(app)/chat/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { MessageView } from '@/features/chat/components/MessageView';
import { Conversation, Message } from '@/shared/types/chatInterface';
import { chatService } from '@/features/chat/services/chatService';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { Button } from '@/shared/components/ui/button';

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<
    Awaited<ReturnType<typeof chatService.searchUsers>>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const currentUserId = user?.id ?? '';

  useEffect(() => {
    let isCurrent = true;
    const fetchConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedConversations = await chatService.getConversations();
        if (!isCurrent) return;
        setConversations(fetchedConversations);
        setSelectedConversation(current =>
          current
            ? fetchedConversations.find(conversation => conversation.id === current.id) ?? null
            : fetchedConversations[0] ?? null,
        );
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
        if (isCurrent) setError('Failed to load conversations. Please try again.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    void fetchConversations();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const search = userSearch.trim();
    if (search.length < 2) {
      setUserResults([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await chatService.searchUsers(search);
        if (isCurrent) setUserResults(results);
      } catch (err) {
        console.error('Failed to search users for messaging:', err);
        if (isCurrent) setError('Unable to search users right now.');
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [userSearch]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let isCurrent = true;
    setMessages([]);
    setError(null);
    const loadMessages = async () => {
      try {
        const fetchedMessages = await chatService.getMessages(selectedConversation.id);
        if (!isCurrent) return;
        setMessages(fetchedMessages);
        await chatService.markMessagesAsRead(selectedConversation.id);
        setConversations(current =>
          current.map(conversation =>
            conversation.id === selectedConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        if (isCurrent) setError('Failed to load messages. Please try again.');
      }
    };
    void loadMessages();
    return () => {
      isCurrent = false;
    };
  }, [selectedConversation]);

  const handleStartConversation = async (targetUserId: string) => {
    setIsStartingConversation(true);
    setError(null);
    try {
      const conversation = await chatService.createConversation(targetUserId);
      setConversations(current => [
        conversation,
        ...current.filter(existing => existing.id !== conversation.id),
      ]);
      setSelectedConversation(conversation);
      setUserSearch('');
      setUserResults([]);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError('Could not start a conversation with this user.');
    } finally {
      setIsStartingConversation(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading Chat...</div>;
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[24rem] w-full min-w-0 overflow-hidden rounded-lg bg-card shadow-lg">
      <div
        className={`${selectedConversation ? 'hidden' : 'flex'} min-h-0 min-w-0 w-full flex-col border-r border-border md:flex md:w-1/3 md:min-w-72 md:max-w-sm`}
      >
        <div className="border-b border-border p-3">
          <label className="flex items-center gap-2 rounded-md border border-input px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={userSearch}
              onChange={event => setUserSearch(event.target.value)}
              placeholder="Find people to message"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              aria-label="Find people to message"
            />
          </label>
          {userSearch.trim().length >= 2 && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              {isSearching ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : userResults.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">No users found.</p>
              ) : (
                userResults.map(result => (
                  <Button
                    key={result.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    disabled={isStartingConversation}
                    onClick={() => void handleStartConversation(result.id)}
                  >
                    {result.name}
                  </Button>
                ))
              )}
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id || null}
          onSelectConversation={id =>
            setSelectedConversation(conversations.find(c => c.id === id) || null)
          }
          currentUserId={currentUserId}
        />
      </div>
      <div className={`${selectedConversation ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 md:flex`}>
        {selectedConversation ? (
          <MessageView
            messages={messages}
            currentUserId={currentUserId}
            conversationTitle={selectedConversation.participants.map(p => p.name).join(', ')}
            onBack={() => setSelectedConversation(null)}
            onSendMessage={async content => {
              if (selectedConversation?.id) {
                try {
                  const message = await chatService.sendMessage(selectedConversation.id, content);
                  setMessages(current => [...current, message]);
                  setConversations(current =>
                    current.map(conversation =>
                      conversation.id === selectedConversation.id
                        ? { ...conversation, lastMessage: message, updatedAt: message.timestamp }
                        : conversation,
                    ),
                  );
                } catch (err) {
                  console.error('Failed to send message:', err);
                  setError('Message could not be sent. Please try again.');
                }
              }
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="font-medium">Your messages</p>
            <p className="text-sm">Search for a person to start a private conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
