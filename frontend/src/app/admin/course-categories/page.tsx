'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderTree, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { Role, getSafeRoles } from '@/shared/enums/role.enum';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { courseService } from '@/features/courses/services/courseService';
import type { Category } from '@/shared/types/courseInterface';

const NO_PARENT = 'none';

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export default function AdminCourseCategoriesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { setHeader } = usePageHeader();
  const roles = getSafeRoles(user?.roles ?? user?.role ?? [], []);
  const isAdmin = roles.includes(Role.admin);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState(NO_PARENT);
  const [isActive, setIsActive] = useState(true);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setError(null);
    try {
      setCategories(await courseService.getCategories(true));
    } catch (cause) {
      console.error('Failed to load course categories', cause);
      setError(cause instanceof Error ? cause.message : 'Course categories could not be loaded.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!isAdmin) router.replace('/unauthorized');
  }, [isAdmin, isAuthenticated, isLoading, router]);

  useEffect(() => {
    setHeader({
      title: 'Course categories',
      description: 'Manage the shared category taxonomy used when creating courses.',
    });
    return () => setHeader(null);
  }, [setHeader]);

  useEffect(() => {
    if (isAdmin) void loadCategories();
  }, [isAdmin, loadCategories]);

  const resetForm = () => {
    setEditingCategoryId(null);
    setName('');
    setSlug('');
    setSlugEdited(false);
    setDescription('');
    setParentId(NO_PARENT);
    setIsActive(true);
  };

  const editCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setName(category.name);
    setSlug(category.slug ?? '');
    setSlugEdited(true);
    setDescription(category.description ?? '');
    setParentId(category.parentId ?? NO_PARENT);
    setIsActive(category.isActive !== false);
    setError(null);
    setSuccess(null);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slugify(slug);
    if (!trimmedName || !trimmedSlug) {
      setError('Enter a category name and a valid slug.');
      return;
    }
    if (parentId !== NO_PARENT && parentId === editingCategoryId) {
      setError('A category cannot be its own parent.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: trimmedName,
        slug: trimmedSlug,
        description: description.trim() || undefined,
        parentId: parentId === NO_PARENT ? null : parentId,
        isActive,
      };
      if (editingCategoryId) {
        await courseService.updateCategory(editingCategoryId, payload);
        setSuccess('Category updated.');
      } else {
        await courseService.createCategory(payload);
        setSuccess('Category created.');
      }
      resetForm();
      await loadCategories();
    } catch (cause) {
      console.error('Failed to save course category', cause);
      setError(cause instanceof Error ? cause.message : 'The category could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`Delete "${category.name}"? Categories with courses or subcategories cannot be deleted.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await courseService.deleteCategory(category.id);
      setSuccess(`“${category.name}” deleted.`);
      await loadCategories();
    } catch (cause) {
      console.error('Failed to delete course category', cause);
      setError(cause instanceof Error ? cause.message : 'The category could not be deleted.');
    }
  };

  if (isLoading || !isAuthenticated || !isAdmin || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-1">
      <div>
        <p className="text-sm font-medium text-primary">Admin workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Course categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep categories centralized. Instructors can select active categories but cannot change the taxonomy.
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">{success}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              {editingCategoryId ? 'Edit category' : 'Create category'}
            </CardTitle>
            <CardDescription>
              Slugs are generated from the name by default and used as stable identifiers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={event => void saveCategory(event)} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="category-name" className="text-sm font-medium">Name *</label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={event => {
                    setName(event.target.value);
                    if (!slugEdited) setSlug(slugify(event.target.value));
                  }}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="category-slug" className="text-sm font-medium">Slug *</label>
                <Input
                  id="category-slug"
                  value={slug}
                  onChange={event => {
                    setSlug(event.target.value);
                    setSlugEdited(true);
                  }}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="category-description" className="text-sm font-medium">Description</label>
                <Textarea
                  id="category-description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="category-parent" className="text-sm font-medium">Parent category</label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="category-parent"><SelectValue placeholder="No parent" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>No parent</SelectItem>
                    {categories
                      .filter(category => category.id !== editingCategoryId)
                      .map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {editingCategoryId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={event => setIsActive(event.target.checked)}
                  />
                  Active and available for new courses
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {saving ? 'Saving…' : editingCategoryId ? 'Save changes' : 'Create category'}
                </Button>
                {editingCategoryId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing categories</CardTitle>
            <CardDescription>Inactive categories remain visible here and can be reactivated.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <p role="status" className="text-sm text-muted-foreground">Loading categories…</p>
            ) : categories.length ? (
              <ul className="divide-y divide-border">
                {categories.map(category => (
                  <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.slug || 'No slug'}{category.parent?.name ? ` · under ${category.parent.name}` : ''}
                        {category.isActive === false ? ' · inactive' : ''}
                      </p>
                      {category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editCategory(category)}>Edit</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => void deleteCategory(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No course categories yet. Create the first one to enable course creation.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
