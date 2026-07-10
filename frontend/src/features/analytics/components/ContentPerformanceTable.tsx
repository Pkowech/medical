// frontend/src/components/admin/ContentPerformanceTable.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { systemAnalyticsService } from '@/features/analytics/services/systemAnalyticsService';
import { ContentPerformanceMetric } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';

export const ContentPerformanceTable: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<ContentPerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const data = await systemAnalyticsService.getContentPerformanceMetrics();
        setPerformanceData(data);
      } catch (err) {
        setError('Failed to fetch content performance data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading content performance...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">Error: {error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {performanceData.length === 0 ? (
          <p className="text-muted-foreground text-center">
            No content performance data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Completion Rate</TableHead>
                  <TableHead>Average Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.map(data => (
                  <TableRow key={data.courseId}>
                    <TableCell className="font-medium">{data.courseName}</TableCell>
                    <TableCell>{data.enrollments}</TableCell>
                    <TableCell>{(data.completionRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{data.averageScore}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table> */}
            <p className="text-red-500">Table component is missing. Please implement it.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentPerformanceTable;
