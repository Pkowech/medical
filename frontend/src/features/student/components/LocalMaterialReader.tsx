'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Upload } from 'lucide-react';
import type { LocalFileMetadata } from '@/lib/core/offline/db';
import { offlineService } from '@/lib/core/offline/offlineService';

export function LocalMaterialReader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [localFileMetadata, setLocalFileMetadata] = useState<LocalFileMetadata | null>(null);
  const [unitIdInput, setUnitIdInput] = useState<string>('');
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const fileSelectionIdRef = useRef(0);
  const params = useParams();
  const unitIdFromRoute = params?.unitId as string | undefined;
  const chosenUnitId = unitIdInput || unitIdFromRoute || undefined;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileSelectionId = ++fileSelectionIdRef.current;

    setSelectedFile(file);
    setError(null);
    setMetadataError(null);
    setLocalFileMetadata(null);
    setFileContent(`File selected: ${file.name}`);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setFileUrl(URL.createObjectURL(file));
    } else {
      setFileUrl(null);
      if (file.type === 'text/plain' || /\.(md|txt)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = e => {
          const text = e?.target?.result;
          setFileContent(typeof text === 'string' ? text : JSON.stringify(text ?? ''));
        };
        reader.onerror = () => setError('Failed to read file');
        reader.readAsText(file);
      }
    }

    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hash = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      const metadata: LocalFileMetadata = {
        id: hash,
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
        size: file.size,
        hash,
      };
      await offlineService.saveLocalFileMetadata(metadata);
      if (fileSelectionIdRef.current === fileSelectionId) {
        setLocalFileMetadata(metadata);
      }
    } catch (metadataSaveError) {
      console.error('Failed to save local file metadata on this device.', metadataSaveError);
      if (fileSelectionIdRef.current === fileSelectionId) {
        setMetadataError('File opened, but its metadata could not be saved on this device.');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);



  // start/stop tracking hook
  const [localPdfCurrentPage, setLocalPdfCurrentPage] = useState<number>(1);
  const [localPdfNumPages, setLocalPdfNumPages] = useState<number | null>(null);

  const computePercent = () => {
    // prefer pdf page-based percent
    if (fileUrl && localPdfNumPages && localPdfNumPages > 0) {
      const p = Math.round((localPdfCurrentPage / localPdfNumPages) * 100);
      return Math.max(0, Math.min(100, p));
    }
    try {
      const el = viewerRef.current;
      if (!el) return 0;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight <= 0) return 100;
      return Math.round((scrollTop / scrollHeight) * 100);
    } catch {
      return 0;
    }
  };

  const { startTracking, stopTracking, isTracking, elapsedSeconds, currentPercent } =
    useMaterialProgressTracker({
      unitId: chosenUnitId,
      computePercent,
      intervalMs: 30000,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          My Local Materials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select a local PDF or text file to read it offline. Its filename, type, size, and SHA-256
          fingerprint are saved in this device&apos;s IndexedDB only. The file itself is not copied
          there, so select it again after refreshing or reopening the app.
        </p>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input type="file" onChange={handleFileChange} accept=".pdf,.txt,.md" />
        </div>
        <div className="flex items-center gap-2 w-full max-w-sm">
          <label className="text-sm text-muted-foreground">Unit ID (optional)</label>
          <input
            value={unitIdInput}
            onChange={e => setUnitIdInput(e.target.value)}
            className="mt-1 block w-full border px-3 py-2 rounded-md"
            aria-label="unit id"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {metadataError && <p className="text-sm text-red-600">{metadataError}</p>}
        {localFileMetadata && (
          <div className="rounded-md border p-3 text-sm" aria-live="polite">
            <p>File details saved on this device only.</p>
            <p>{localFileMetadata.filename}</p>
            <p>
              {localFileMetadata.mimetype} · {localFileMetadata.size} bytes
            </p>
            <p className="break-all">SHA-256: {localFileMetadata.hash}</p>
          </div>
        )}
        {(fileContent || fileUrl) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Viewer</CardTitle>
            </CardHeader>
            <CardContent>
              {fileUrl ? (
                // render PDF viewer for local pdf
                <div className="p-4 border rounded-md bg-gray-50 h-96 overflow-y-auto">
                  {/* PDF viewer for local file */}
                  {/* Lazy load to avoid SSR */}
                  <div className="w-full h-[70vh]">
                    {/* We dynamically import the PDF viewer component */}
                    <PDFViewer
                      file={fileUrl}
                      onPageChange={(current, total) => {
                        setLocalPdfCurrentPage(current);
                        setLocalPdfNumPages(total);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  ref={viewerRef}
                  className="p-4 border rounded-md bg-gray-50 h-96 overflow-y-auto"
                >
                  <pre>{fileContent}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <div className="flex gap-4 items-center">
          <div className="text-sm text-gray-500">
            <span
              className={`inline-block h-2 w-2 rounded-full mr-2 ${isTracking ? 'bg-green-500' : 'bg-gray-300'}`}
            />
            {isTracking ? 'Tracking' : 'Not tracking'}
          </div>
          <div className="text-sm text-gray-500">Progress: {currentPercent ?? 0}%</div>
          <div className="text-sm text-gray-500">
            Elapsed: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
          </div>
          {!isTracking ? (
            <Button
              onClick={async () => {
                if (!selectedFile) {
                  setError('Please select a file first.');
                  return;
                }
                startTracking();
              }}
              disabled={!selectedFile}
            >
              Start Tracking
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await stopTracking();
                setError(null);
              }}
              variant="secondary"
            >
              Stop Tracking
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
