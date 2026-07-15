'use client';

import React, { useState, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { useXapi } from '@/lib/xapi/useXapi';
import { Maximize, Minimize, Play, Pause, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title: string;
  lessonId: string | number;
}

export const VideoPlayer = ({ url, title, lessonId }: VideoPlayerProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef<any>(null);

  const objectId = `https://medtrackhub.com/units/${lessonId}/video`;
  const object = {
    id: objectId,
    definition: {
      name: { 'en-US': title },
      type: 'http://adlnet.gov/expapi/activities/video',
    },
  };

  const handlePlay = useCallback(() => {
    setPlaying(true);
    trackAction(XAPI_VERBS.PLAYED, object, {
      extensions: {
        'https://w3id.org/xapi/video/extensions/time': played * duration,
      },
    });
  }, [trackAction, XAPI_VERBS.PLAYED, object, played, duration]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    trackAction(XAPI_VERBS.PAUSED, object, {
      extensions: {
        'https://w3id.org/xapi/video/extensions/time': played * duration,
      },
    });
  }, [trackAction, XAPI_VERBS.PAUSED, object, played, duration]);

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setPlayed(state.played);
    // Track progress at certain milestones (25%, 50%, 75%, 90%)
    const milestones = [0.25, 0.5, 0.75, 0.9];
    const prevPlayed = played;
    milestones.forEach(m => {
        if (prevPlayed < m && state.played >= m) {
            trackAction(XAPI_VERBS.PROGRESSED, object, {
                extensions: {
                    'http://id.tincanapi.com/extension/progress': Math.round(m * 100),
                }
            });
        }
    });
  };

  const handleEnded = () => {
    setPlaying(false);
    trackAction(XAPI_VERBS.COMPLETED, object, {
      extensions: {
        'https://w3id.org/xapi/video/extensions/time': duration,
      },
    });
  };

  const handleDuration = (d: number) => {
    setDuration(d);
  };

  return (
    <div className="relative group w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-700">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}
      
      <ReactPlayer
        {...({
          ref: playerRef,
          url,
          width: '100%',
          height: '100%',
          playing,
          controls: true,
          onReady: () => setIsReady(true),
          onPlay: handlePlay,
          onPause: handlePause,
          onProgress: handleProgress as any,
          onEnded: handleEnded,
          onDuration: handleDuration,
          config: ({ youtube: { playerVars: { showinfo: 1, modestbranding: 1, rel: 0 } } } as any),
        } as any)}
      />

      {/* Premium Overlay for Play/Pause when not using native controls (optional) */}
      {!playing && isReady && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer transition-opacity group-hover:opacity-100"
          onClick={() => setPlaying(true)}
        >
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40 transform transition-transform hover:scale-110">
            <Play className="w-8 h-8 text-white fill-current ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};
