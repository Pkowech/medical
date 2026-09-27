'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/shared/components/forms/FileUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, Library, Upload } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { MaterialLibraryPicker } from '@/features/materials/components/MaterialLibraryPicker';
import { materialService } from '@/features/courses/services/materialService';
import { Material } from '@/shared/types/materialInterface';

export default function MaterialUploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  // ── Handle fresh file upload ───────────────────────────────────────────────
  const handleUploadComplete = (material: unknown) => {
    if (typeof material === 'object' && material !== null && 'title' in material) {
      toast({
        title: 'Upload successful',
        description: `"${(material as Record<string, unknown>).title}" has been added to the library.`,
      });
    }
  };

  // ── Handle attach-from-library ─────────────────────────────────────────────
  const handleAttachFromLibrary = async (
    material: Material,
    context: { topicId?: string; unitId?: string; courseId?: string; title: string },
  ) => {
    const attached = await materialService.attachMaterial({
      sourceMaterialId: material.id as string,
      title: context.title,
      topicId: context.topicId,
      unitId: context.unitId,
      courseId: context.courseId,
    });
    toast({
      title: 'Attached from library',
      description: `"${attached.title}" linked — no file re-uploaded.`,
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 pl-0 hover:pl-2 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Materials Library</h1>
        <p className="text-muted-foreground mt-2">
          Upload a new file{' '}
          <span className="text-gray-400 mx-1">·</span> or attach an existing R2
          textbook to another course or topic — no re-upload needed.
        </p>
      </div>

      {/* ── Action cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* Card 1: Upload new file */}
        <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Upload New File</CardTitle>
            </div>
            <CardDescription>
              Upload a PDF, DOCX, PPTX, image, or video from your computer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onUploadComplete={handleUploadComplete}
              allowedFileTypes={['.pdf', '.doc', '.docx', '.txt', '.md', '.jpg', '.jpeg', '.png', '.pptx']}
              maxFileSizeMB={50}
            />
          </CardContent>
        </Card>

        {/* Card 2: Attach from library */}
        <Card className="border-2 hover:border-primary/50 transition-colors flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Attach from R2 Library</CardTitle>
            </div>
            <CardDescription>
              Reuse an already-uploaded textbook or resource across multiple courses
              for different degree programmes (MBChB, BPharm, Nursing) — zero
              re-upload, zero extra storage cost.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 mb-4 text-sm text-blue-800">
              <p className="font-medium mb-1">How it works</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Browse the R2 library of uploaded files.</li>
                <li>Pick the textbook chapter or slide deck you want to reuse.</li>
                <li>Give it a context-specific display title for the new course.</li>
                <li>Instantly linked — same R2 bytes, new lightweight DB record.</li>
              </ol>
            </div>
            <Button className="w-full" onClick={() => setShowLibraryPicker(true)}>
              <Library className="w-4 h-4 mr-2" />
              Browse &amp; Attach from Library
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Guidelines ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="prose text-sm text-muted-foreground">
          <ul>
            <li>Ensure files are properly named before uploading.</li>
            <li>Add descriptive titles and optional descriptions to help students find content.</li>
            <li>Large files may take a few moments to verify and process.</li>
            <li>Copyrighted material should only be uploaded if you have the necessary rights.</li>
            <li>
              Use <strong>Attach from Library</strong> when the same textbook is needed in multiple
              courses — avoids duplicating storage in Cloudflare R2.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Library Picker Modal ─────────────────────────────────────────────── */}
      {showLibraryPicker && (
        <MaterialLibraryPicker
          onClose={() => setShowLibraryPicker(false)}
          onAttach={handleAttachFromLibrary}
        />
      )}
    </div>
  );
}
