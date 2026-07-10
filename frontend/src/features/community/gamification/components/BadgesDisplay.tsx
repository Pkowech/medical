// frontend/src/components/gamification/BadgesDisplay.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getAllBadges, getUserBadges } from '../services/gamificationService';
import { useSession } from 'next-auth/react';
import { Badge as BadgeType } from '@/features/community/gamification/types/gamification';
import { Award, Check } from 'lucide-react';
import Image from 'next/image';

export const BadgesDisplay: React.FC = () => {
  const [userBadges, setUserBadges] = useState<BadgeType[]>([]);
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        // Try new dashboard API first
        const fetchedAllBadges = await getAllBadges();
        // Normalize: support APIs that return { data: [...] } or the array directly
        const allFromData = (fetchedAllBadges as unknown) as { data?: unknown };
        if (allFromData && Array.isArray(allFromData.data)) {
          setAllBadges(allFromData.data as BadgeType[]);
        } else if (Array.isArray(fetchedAllBadges)) {
          setAllBadges(fetchedAllBadges as BadgeType[]);
        } else {
          setAllBadges([]);
        }

        if (userId) {
          const fetchedUserBadges = await getUserBadges(userId);
          const userFromData = (fetchedUserBadges as unknown) as { data?: unknown };
          if (userFromData && Array.isArray(userFromData.data)) {
            setUserBadges(userFromData.data as BadgeType[]);
          } else if (Array.isArray(fetchedUserBadges)) {
            setUserBadges(fetchedUserBadges as BadgeType[]);
          } else {
            setUserBadges([]);
          }
        } else {
          // Fallback to legacy service for tests/dev
          const fetchedUserBadges = await getUserBadges('');
          setUserBadges(Array.isArray(fetchedUserBadges) ? (fetchedUserBadges as BadgeType[]) : []);
        }
      } catch (err) {
        setError('Failed to fetch badges.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading badges...</CardContent>
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

  const earnedBadgeIds = new Set(userBadges.map(badge => badge.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Award className="mr-2" /> Your Badges
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {allBadges.length === 0 ? (
          <p className="col-span-full text-muted-foreground">No badges available yet.</p>
        ) : (
          allBadges.map(badge => {
            const isEarned = earnedBadgeIds.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center text-center p-4 rounded-lg border ${isEarned ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}
              >
                <div className={`relative w-16 h-16 mb-2 ${isEarned ? '' : 'grayscale'}`}>
                  {/* Placeholder for image, replace with actual Image component if icons are available */}
                  {badge.icon ? (
                    <Image
                      src={badge.icon}
                      alt={badge.name}
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                      <Award className="w-8 h-8" />
                    </div>
                  )}
                  {isEarned && (
                    <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm">{badge.name}</h3>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
                {isEarned && userBadges.find(ub => ub.id === badge.id)?.earnedDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Earned:{' '}
                    {new Date(
                      userBadges.find(ub => ub.id === badge.id)!.earnedDate!
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
