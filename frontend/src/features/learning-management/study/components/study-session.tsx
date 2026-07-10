import React, { useState, useEffect } from 'react';
import { useStudy } from '../hooks/useStudy';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Play, Pause, Square, BookOpen, Sparkles, ScrollText } from 'lucide-react';
interface StudySessionProps {
  topicId: string;
  onSessionEnd: () => void;
}

type Activity = { type: 'reading' | 'quiz' | 'notes'; durationMinutes: number; timestamp: Date };


export const StudySession: React.FC<StudySessionProps> = ({ topicId, onSessionEnd }) => {
  const { startSession, endSession } = useStudy();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let timer: number | undefined;
    if (isActive) {
      timer = window.setInterval(() => {
        setElapsedTime((prev: number) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isActive]);

  const handleStart = async () => {
    try {
      const session = await startSession(topicId);
      if (session) {
        setSessionId(session.id);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleStop = () => {
    setShowEndDialog(true);
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      await endSession(sessionId, undefined, notes);
      onSessionEnd();
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const addActivity = (type: Activity['type']) => {
    setActivities(prev => [
      ...prev,
      {
        type,
        durationMinutes: Math.floor(elapsedTime / 60),
        timestamp: new Date(),
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Study Session</h2>
            <div className="text-3xl font-mono text-blue-600 dark:text-blue-400">
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            {!isActive ? (
              <Button onClick={handleStart} className="w-40">
                <Play className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handlePause} className="w-32">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={handleStop} className="w-32">
                  <Square className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('reading')}
              title="Add Reading Activity"
              className="h-10 w-10"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('quiz')}
              title="Add Quiz Activity"
              className="h-10 w-10"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('notes')}
              title="Add Notes Activity"
              className="h-10 w-10"
            >
              <ScrollText className="h-5 w-5" />
            </Button>
          </div>

          {activities.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Activities</h3>
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-2">
                  {activities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {activity.type === 'reading' && <BookOpen className="h-4 w-4" />}
                      {activity.type === 'quiz' && <Sparkles className="h-4 w-4" />}
                      {activity.type === 'notes' && <ScrollText className="h-4 w-4" />}
                      <span>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} -{' '}
                        {activity.durationMinutes} minutes
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEndDialog} onOpenChange={open => setShowEndDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Study Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Session Duration</Label>
              <p className="text-lg font-mono text-blue-600 dark:text-blue-400">
                {formatTime(elapsedTime)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write your session notes here..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndSession}>End Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
