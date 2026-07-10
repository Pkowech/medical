import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { formatDateSafe } from './displayUtils';
import type { ProgressActivity } from '@/shared/types/progressInterface';

const ActivitiesList = ({ activities }: { activities?: ProgressActivity[] }) => {
  if (!activities || activities.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Recent Activities</h2>
      <Card>
        <CardContent className="p-4">
          <ul className="space-y-4">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start">
                <div className="shrink-0 h-4 w-4 rounded-full bg-slate-400 dark:bg-slate-600 mt-1" />
                <div className="ml-3">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-gray-500">{formatDateSafe(activity.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivitiesList;
