'use client';

import React, { useEffect, useState } from 'react';
import { getUserActivityMetrics } from '@/features/analytics/services/systemAnalyticsService';
import { UserActivityMetric } from '@/shared/types/systemInterface';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertCircle } from 'lucide-react';

export const UserActivityChart: React.FC = () => {
  const [activityData, setActivityData] = useState<UserActivityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        const data = await getUserActivityMetrics();
        setActivityData(data);
      } catch (err) {
        setError('Failed to fetch user activity data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, []);

  if (loading) {
    return (
      <div className="h-80 w-full bg-gray-200 rounded-md animate-pulse flex items-center justify-center">
        <p className="text-gray-500">Loading user activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertCircle className="mr-2 h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="h-80">
      {activityData.length === 0 ? (
        <p className="text-muted-foreground text-center">No user activity data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activityData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="logins" fill="#3b82f6" name="Logins" />
            <Bar dataKey="studySessions" fill="#10b981" name="Study Sessions" />
            <Bar dataKey="messagesSent" fill="#8b5cf6" name="Messages Sent" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default UserActivityChart;
