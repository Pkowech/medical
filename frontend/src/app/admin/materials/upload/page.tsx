'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/shared/components/forms/FileUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';

export default function MaterialUploadPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleUploadComplete = (material: unknown) => {
    if (typeof material === 'object' && material !== null && 'title' in material) {
      toast({
        title: 'Success',
        description: `Material "${(material as Record<string, unknown>).title}" uploaded successfully.`,
      });
    }
    // Optional: Redirect to materials list or content page
    // router.push('/admin/content');
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
        <h1 className="text-3xl font-bold tracking-tight">Upload Material</h1>
        <p className="text-muted-foreground mt-2">
          Upload new study materials, documents, or resources to the course library.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Supported formats: PDF, DOCX, TXT, MD, Images. Max size: 50MB.
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

        <Card>
          <CardHeader>
            <CardTitle>Upload Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="prose text-sm text-muted-foreground">
            <ul>
              <li>Ensure files are properly named before uploading.</li>
              <li>Add descriptive titles and optional descriptions to help students find content.</li>
              <li>Large files may take a few moments to verify and process.</li>
              <li>Copyrighted material should only be uploaded if you have the necessary rights.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
