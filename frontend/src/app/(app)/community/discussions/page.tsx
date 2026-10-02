'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus, Users } from 'lucide-react';
import { forumService, Forum, Topic } from '@/features/community/forumService';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

export default function DiscussionsPage() {
  const [forums, setForums] = useState<Forum[]>([]);
  const [selectedForum, setSelectedForum] = useState<Forum | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingForums, setIsLoadingForums] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showForumForm, setShowForumForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [forumName, setForumName] = useState('');
  const [forumDescription, setForumDescription] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicContent, setTopicContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadForums = useCallback(async () => {
    setIsLoadingForums(true);
    setError(null);
    try {
      const nextForums = await forumService.getForums();
      setForums(nextForums);
      setSelectedForum(current =>
        current ? nextForums.find(forum => forum.id === current.id) ?? null : null,
      );
    } catch (cause) {
      console.error('Failed to load discussion forums:', cause);
      setError(cause instanceof Error ? cause.message : 'Unable to load discussion forums.');
    } finally {
      setIsLoadingForums(false);
    }
  }, []);

  useEffect(() => {
    void loadForums();
  }, [loadForums]);

  useEffect(() => {
    if (!selectedForum) {
      setTopics([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingTopics(true);
    setError(null);
    forumService
      .getTopics(selectedForum.id)
      .then(nextTopics => {
        if (isCurrent) setTopics(nextTopics);
      })
      .catch(cause => {
        console.error('Failed to load discussion topics:', cause);
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Unable to load discussions.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingTopics(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedForum]);

  const handleCreateForum = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forumName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const forum = await forumService.createForum({
        name: forumName.trim(),
        description: forumDescription.trim() || undefined,
      });
      setForums(current => [forum, ...current]);
      setSelectedForum(forum);
      setForumName('');
      setForumDescription('');
      setShowForumForm(false);
    } catch (cause) {
      console.error('Failed to create discussion forum:', cause);
      setError(cause instanceof Error ? cause.message : 'Unable to create the forum.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedForum || !topicTitle.trim() || !topicContent.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await forumService.createTopic(selectedForum.id, {
        title: topicTitle.trim(),
        content: topicContent.trim(),
      });
      const nextTopics = await forumService.getTopics(selectedForum.id);
      setTopics(nextTopics);
      setTopicTitle('');
      setTopicContent('');
      setShowTopicForm(false);
    } catch (cause) {
      console.error('Failed to create discussion topic:', cause);
      setError(cause instanceof Error ? cause.message : 'Unable to create the discussion.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Discussions</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Share questions and ideas with the MedTrack community.
          </p>
        </div>
        <Button onClick={() => setShowForumForm(value => !value)}>
          <Plus className="mr-2 h-4 w-4" />
          Create forum
        </Button>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {showForumForm && (
        <Card>
          <CardHeader>
            <CardTitle>Start a forum</CardTitle>
            <CardDescription>Create a space for a topic or study area.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreateForum}>
              <label className="grid gap-1 text-sm font-medium">
                Forum name
                <input
                  className="rounded-md border border-input bg-background px-3 py-2"
                  value={forumName}
                  onChange={event => setForumName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Description
                <input
                  className="rounded-md border border-input bg-background px-3 py-2"
                  value={forumDescription}
                  onChange={event => setForumDescription(event.target.value)}
                  maxLength={300}
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Creating…' : 'Create forum'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForumForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
        <section aria-label="Discussion forums">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Forums
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingForums ? (
                <p className="text-sm text-muted-foreground">Loading forums…</p>
              ) : forums.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No forums yet. Create one to start the conversation.
                </p>
              ) : (
                forums.map(forum => (
                  <button
                    key={forum.id}
                    type="button"
                    onClick={() => setSelectedForum(forum)}
                    aria-pressed={selectedForum?.id === forum.id}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedForum?.id === forum.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <span className="block font-medium">{forum.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {forum.topicCount} {forum.topicCount === 1 ? 'discussion' : 'discussions'}
                    </span>
                  </button>
                ))
              )}
              {!isLoadingForums && (
                <Button variant="outline" className="w-full" onClick={() => void loadForums()}>
                  Refresh forums
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Forum discussions" className="space-y-4">
          {!selectedForum ? (
            <Card>
              <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Choose a forum</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a forum to read its discussions, or create one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selectedForum.name}</h2>
                  {selectedForum.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedForum.description}</p>
                  )}
                </div>
                <Button onClick={() => setShowTopicForm(value => !value)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start discussion
                </Button>
              </div>

              {showTopicForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>Start a discussion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={handleCreateTopic}>
                      <label className="grid gap-1 text-sm font-medium">
                        Title
                        <input
                          className="rounded-md border border-input bg-background px-3 py-2"
                          value={topicTitle}
                          onChange={event => setTopicTitle(event.target.value)}
                          maxLength={150}
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        Message
                        <textarea
                          className="min-h-28 rounded-md border border-input bg-background px-3 py-2"
                          value={topicContent}
                          onChange={event => setTopicContent(event.target.value)}
                          maxLength={5000}
                          required
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={isSaving}>
                          {isSaving ? 'Posting…' : 'Post discussion'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowTopicForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {isLoadingTopics ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading discussions…</CardContent></Card>
              ) : topics.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    There are no discussions here yet. Start the first one.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {topics.map(topic => (
                    <Card key={topic.id}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {topic.metadata?.title || topic.content}
                        </CardTitle>
                        <CardDescription>
                          {new Date(topic.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {topic.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
