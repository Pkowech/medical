import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Trophy } from 'lucide-react';
import { formatDateSafe } from './displayUtils';
import type { Achievement } from '@/shared/types/progressInterface';

const AchievementsList = ({ achievements }: { achievements?: Achievement[] }) => {
  if (!achievements || achievements.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Achievements</h2>
      <Card>
        <CardContent className="p-4">
          <ul className="space-y-4">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="flex items-center p-2 border rounded-lg">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{achievement.title}</p>
                  <p className="text-xs text-gray-500">{achievement.description}</p>
                </div>
                <div className="ml-auto text-xs text-gray-500">{formatDateSafe(achievement.dateEarned)}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AchievementsList;
