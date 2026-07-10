'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Upload, X, File, Check } from 'lucide-react';
import materialService from '@/features/courses/services/materialService';

interface FileUploadProps {
  onUploadComplete?: (material: unknown) => void;
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
}

export default function FileUpload({
  onUploadComplete,
  allowedFileTypes = ['.pdf', '.doc', '.docx', '.txt', '.md', '.jpg', '.jpeg', '.png'],
  maxFileSizeMB = 10,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError('');

    if (!selectedFile) {
      return;
    }

    // Check file size
    if (selectedFile.size > maxFileSizeMB * 1024 * 1024) {
      setError(`File size exceeds the maximum limit of ${maxFileSizeMB}MB`);
      return;
    }

    // Check file type
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!allowedFileTypes.includes(fileExtension)) {
      setError(`File type not supported. Allowed types: ${allowedFileTypes.join(', ')}`);
      return;
    }

    setFile(selectedFile);

    // Auto-fill title with file name (without extension)
    const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
    setTitle(fileName);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    // Check file size
    if (droppedFile.size > maxFileSizeMB * 1024 * 1024) {
      setError(`File size exceeds the maximum limit of ${maxFileSizeMB}MB`);
      return;
    }

    // Check file type
    const fileExtension = '.' + droppedFile.name.split('.').pop()?.toLowerCase();
    if (!allowedFileTypes.includes(fileExtension)) {
      setError(`File type not supported. Allowed types: ${allowedFileTypes.join(', ')}`);
      return;
    }

    setFile(droppedFile);

    // Auto-fill title with file name (without extension)
    const fileName = droppedFile.name.split('.').slice(0, -1).join('.');
    setTitle(fileName);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const simulateUploadProgress = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 100);
    return interval;
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for your material');
      return;
    }

    setIsUploading(true);
    setError('');

    // Simulate upload progress
    const progressInterval = simulateUploadProgress();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);

      // Upload to the real API endpoint
      try {
        const data = await materialService.uploadMaterial(formData, {
          onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            }
          }
        });

        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadComplete(true);

        if (onUploadComplete) {
          onUploadComplete(data);
        }
      } catch (apiError) {
        console.error('Upload failed:', apiError);
        setError(apiError instanceof Error ? apiError.message : 'Upload failed. Please try again.');
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setFile(null);
        setTitle('');
        setDescription('');
        setIsUploading(false);
        setUploadProgress(0);
        setUploadComplete(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Error uploading file:', error);
      setError('Failed to upload file. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = () => {
    if (!file) return null;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'pdf':
        return <File className="h-12 w-12 text-red-500" />;
      case 'doc':
      case 'docx':
        return <File className="h-12 w-12 text-blue-500" />;
      case 'txt':
      case 'md':
        return <File className="h-12 w-12 text-gray-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <File className="h-12 w-12 text-green-500" />;
      default:
        return <File className="h-12 w-12 text-gray-500" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Study Material</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* File Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-400'
            } transition-colors duration-200`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {!file ? (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-sm text-gray-500">
                  Drag and drop your file here, or{' '}
                  <label className="text-blue-500 cursor-pointer hover:text-blue-700">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      accept={allowedFileTypes.join(',')}
                    />
                  </label>
                </p>
                <p className="text-xs text-gray-400">
                  Supported file types: {allowedFileTypes.join(', ')}
                </p>
                <p className="text-xs text-gray-400">Maximum file size: {maxFileSizeMB}MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center">
                  {getFileIcon()}
                  <button
                    onClick={handleRemoveFile}
                    className="ml-2 text-gray-400 hover:text-red-500"
                    title="Remove file"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>}

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a title for your material"
                disabled={isUploading}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a description for your material"
                rows={3}
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Upload Complete */}
          {uploadComplete && (
            <div className="flex items-center p-2 bg-green-50 text-green-700 rounded-md">
              <Check className="h-5 w-5 mr-2" />
              <span>Upload complete!</span>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end">
            <Button
              variant="default"
              onClick={handleUpload}
              disabled={!file || isUploading || !title.trim()}
              isLoading={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Material'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
