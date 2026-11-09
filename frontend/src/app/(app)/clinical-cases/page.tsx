'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, RefreshCw, Stethoscope } from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

interface ClinicalCaseSummary {
  id: string;
  title: string;
  description: string;
  complexity: string;
  specialty: string;
  status: string;
}

export default function ClinicalCasesPage() {
  const [cases, setCases] = useState<ClinicalCaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await apiService.get<ClinicalCaseSummary[]>('/clinical-cases', {
        params: { status: 'published' },
      });
      setCases(response.data);
    } catch (loadError) {
      console.error('Failed to load clinical cases:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground" aria-live="polite">Loading clinical cases…</p>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Clinical cases couldn’t be loaded.</p>
        <Button variant="outline" onClick={() => void loadCases()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="p-6 text-center">
        <Stethoscope className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="font-semibold">No clinical cases available</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Published cases will appear here when they’re ready.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {cases.map((clinicalCase) => (
        <Card key={clinicalCase.id} className="transition-colors hover:border-primary/50">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{clinicalCase.specialty.replaceAll('_', ' ')}</Badge>
              <Badge>{clinicalCase.complexity.replaceAll('_', ' ')}</Badge>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{clinicalCase.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {clinicalCase.description}
              </p>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Interactive case
              </span>
              <Button asChild size="sm">
                <Link href={`/clinical-cases/${clinicalCase.id}`}>Start case</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
