'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, LogOut, Plus, RefreshCw, Users, UserRoundPlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  studyGroupService,
  type StudyGroupRecord,
} from '@/features/learning-management/study-groups/services/studyGroupService';

const GROUP_TYPES: Array<{ value: StudyGroupRecord['type']; label: string }> = [
  { value: 'general', label: 'General study' },
  { value: 'course_specific', label: 'Course study' },
  { value: 'exam_prep', label: 'Exam preparation' },
  { value: 'research', label: 'Research' },
  { value: 'clinical_cases', label: 'Clinical cases' },
];

const getMemberCount = (group: StudyGroupRecord): number | null => {
  const count = group.metadata?.memberCount;
  if (typeof count === 'number' && Number.isFinite(count)) return count;
  return Array.isArray(group.members) ? group.members.length : null;
};

const getGroupError = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function StudyGroupsPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<StudyGroupRecord['type']>('general');
  const [actionError, setActionError] = useState('');

  const {
    data: publicGroups = [],
    isLoading: isLoadingPublicGroups,
    isError: publicGroupsError,
    refetch: refetchPublicGroups,
  } = useQuery({
    queryKey: ['study-groups', 'public'],
    queryFn: () => studyGroupService.listGroups(),
  });
  const {
    data: myGroups = [],
    isLoading: isLoadingMyGroups,
    isError: myGroupsError,
    refetch: refetchMyGroups,
  } = useQuery({
    queryKey: ['study-groups', 'mine'],
    queryFn: () => studyGroupService.listMyGroups(),
  });

  const refreshGroups = () =>
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });

  const createGroup = useMutation({
    mutationFn: () => studyGroupService.createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      privacy: 'public',
      maxMembers: 50,
    }),
    onSuccess: async () => {
      setName('');
      setDescription('');
      setType('general');
      setShowCreateForm(false);
      setActionError('');
      await refreshGroups();
    },
    onError: error => setActionError(getGroupError(error, 'Could not create the study group.')),
  });
  const joinGroup = useMutation({
    mutationFn: (groupId: string) => studyGroupService.joinGroup(groupId),
    onSuccess: async () => {
      setActionError('');
      await refreshGroups();
    },
    onError: error => setActionError(getGroupError(error, 'Could not join this study group.')),
  });
  const leaveGroup = useMutation({
    mutationFn: (groupId: string) => studyGroupService.leaveGroup(groupId),
    onSuccess: async () => {
      setActionError('');
      await refreshGroups();
    },
    onError: error => setActionError(getGroupError(error, 'Could not leave this study group.')),
  });

  const myGroupIds = useMemo(() => new Set(myGroups.map(group => group.id)), [myGroups]);
  const availableGroups = publicGroups.filter(group => !myGroupIds.has(group.id));
  const isMutating = createGroup.isPending || joinGroup.isPending || leaveGroup.isPending;

  const submitCreateForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setActionError('');
    createGroup.mutate();
  };

  const renderGroupCard = (group: StudyGroupRecord, membership: 'member' | 'available') => (
    <Card key={group.id}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{group.name}</CardTitle>
            <CardDescription className="mt-1">
              {GROUP_TYPES.find(groupType => groupType.value === group.type)?.label ?? 'Study group'}
              {getMemberCount(group) !== null &&
                ` · ${getMemberCount(group)} member${getMemberCount(group) === 1 ? '' : 's'}`}
            </CardDescription>
          </div>
          <Users aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="min-h-10 text-sm text-muted-foreground">
          {group.description || 'A place to learn and collaborate with other students.'}
        </p>
        {membership === 'member' ? (
          <Button
            type="button"
            variant="outline"
            disabled={isMutating}
            onClick={() => leaveGroup.mutate(group.id)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Leave group
          </Button>
        ) : (
          <Button
            type="button"
            disabled={isMutating}
            onClick={() => joinGroup.mutate(group.id)}
          >
            <UserRoundPlus className="mr-2 h-4 w-4" />
            Join group
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Study Groups</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Find peers to study with, or create a group around a course, exam, or clinical topic.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreateForm(value => !value)}>
          <Plus className="mr-2 h-4 w-4" />
          Create group
        </Button>
      </header>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create a public study group</CardTitle>
            <CardDescription>Public groups can be discovered and joined by other students.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitCreateForm}>
              <label className="grid gap-1 text-sm font-medium">
                Group name
                <input
                  className="rounded-md border border-input bg-background px-3 py-2"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Group focus
                <select
                  className="rounded-md border border-input bg-background px-3 py-2"
                  value={type}
                  onChange={event => setType(event.target.value as StudyGroupRecord['type'])}
                >
                  {GROUP_TYPES.map(groupType => (
                    <option key={groupType.value} value={groupType.value}>{groupType.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                Description
                <textarea
                  className="min-h-20 rounded-md border border-input bg-background px-3 py-2"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={500}
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={!name.trim() || isMutating}>
                  {createGroup.isPending ? 'Creating…' : 'Create group'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="my-study-groups" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="my-study-groups" className="text-xl font-semibold">My groups</h2>
            <p className="text-sm text-muted-foreground">Groups you’ve joined or created.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void refetchMyGroups()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {isLoadingMyGroups ? (
          <p role="status" className="text-sm text-muted-foreground">Loading your groups…</p>
        ) : myGroupsError ? (
          <p role="alert" className="text-sm text-destructive">
            Your groups could not be loaded.{' '}
            <button type="button" className="font-semibold underline" onClick={() => void refetchMyGroups()}>
              Retry
            </button>
          </p>
        ) : myGroups.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myGroups.map(group => renderGroupCard(group, 'member'))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <BookOpen aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You haven’t joined a study group yet.</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="discover-study-groups" className="space-y-4">
        <div>
          <h2 id="discover-study-groups" className="text-xl font-semibold">Discover public groups</h2>
          <p className="text-sm text-muted-foreground">Join an existing group to study together.</p>
        </div>
        {isLoadingPublicGroups ? (
          <p role="status" className="text-sm text-muted-foreground">Loading public groups…</p>
        ) : publicGroupsError ? (
          <p role="alert" className="text-sm text-destructive">
            Public groups could not be loaded.{' '}
            <button type="button" className="font-semibold underline" onClick={() => void refetchPublicGroups()}>
              Retry
            </button>
          </p>
        ) : availableGroups.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableGroups.map(group => renderGroupCard(group, 'available'))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No public groups are available right now. You can create one for your peers.
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
