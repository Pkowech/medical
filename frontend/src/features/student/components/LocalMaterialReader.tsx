'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import { apiService as api } from '@/features/auth/services/apiClient';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Upload } from 'lucide-react';
import { Material, AppFile } from '@/shared/types/materialInterface';
import offlineSync from '@/features/learning-management/services/offlineProgressSync'; // Import offlineSync

export function LocalMaterialReader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredMaterialId, setRegisteredMaterialId] = useState<string | null>(null);
  const [registeredFileHash, setRegisteredFileHash] = useState<string | null>(null);
  const [unitIdInput, setUnitIdInput] = useState<string>('');
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const params = useParams();
  const unitIdFromRoute = params?.unitId as string | undefined;
  const chosenUnitId = unitIdInput || unitIdFromRoute || undefined;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      // For now, we'll just show the file name.
      // In the next step, we will add logic to read and display the content.
      setFileContent(`File selected: ${file.name}`);
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const url = URL.createObjectURL(file);
        // revoke previously created object URL
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        setFileUrl(url);
      } else {
        setFileUrl(null);
        // try reading text files
        if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const reader = new FileReader();
          reader.onload = e => {
            const text = e?.target?.result;
            setFileContent(typeof text === 'string' ? text : JSON.stringify(text ?? ''));
          };
          reader.onerror = () => setError('Failed to read file');
          reader.readAsText(file);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, []);



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
      materialId: registeredMaterialId || undefined,
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
          Select a local file (PDF, text) to track your reading progress. The file content stays on
          your device.
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
                // compute hash and register local material if not already registered
                try {
                  const buffer = await selectedFile.arrayBuffer();
                  const digest = await crypto.subtle.digest('SHA-256', buffer);
                  const hashArray = Array.from(new Uint8Array(digest));
                  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                  // register local material
                  const res = await api.post<{
                    material: Material;
                    fileRecord: AppFile;
                  }>('/materials/local/register', {
                    hash: hashHex,
                    filename: selectedFile.name,
                    mimetype: selectedFile.type || 'application/octet-stream',
                    size: selectedFile.size,
                    unitId: chosenUnitId || undefined,
                  });

                  // res.data might include created material
                  if (res?.data?.material?.id) {
                    // Persist registered material and file hash so tracker can send progress
                    setRegisteredMaterialId(res.data.material.id);
                    setRegisteredFileHash(hashHex);
                  }
                } catch (err) {
                  console.error('Failed to register local material', err);
                }
                // start tracking
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
                const payload = {
                  hash: registeredFileHash || undefined,
                  materialId: registeredMaterialId || undefined,
                  percent: currentPercent ?? 0,
                  timeSpentSeconds: elapsedSeconds,
                  lastPage: localPdfCurrentPage,
                  unitId: chosenUnitId || undefined,
                };
                try {
                  await api.post('/materials/local/progress', payload);
                } catch (err) {
                  console.error('Failed to register local progress, adding to offline queue', err);
                  offlineSync.addToQueue({
                    materialId: payload.materialId,
                    unitId: payload.unitId,
                    percent: payload.percent,
                    page: payload.lastPage,
                    timeSpentMinutes: payload.timeSpentSeconds
                      ? Math.floor(payload.timeSpentSeconds / 60)
                      : 0,
                    xapiStatement: {
                      payloadFor: 'local-progress',
                      hash: payload.hash,
                      timeSpentSeconds: payload.timeSpentSeconds,
                    },
                  });
                }
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
