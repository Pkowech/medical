'use client';

import React, { useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { Play, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title: string;
  lessonId: string | number;
  theaterMode?: boolean;
}

const getYouTubeEmbedUrl = (value: string): string | null => {
  try {
    const videoUrl = new URL(value);
    const hostname = videoUrl.hostname.toLowerCase();
    const isYouTube = hostname === 'youtu.be'
      || hostname.endsWith('.youtu.be')
      || hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com');
    if (!isYouTube) return null;

    const videoId = hostname.endsWith('youtu.be')
      ? videoUrl.pathname.split('/').filter(Boolean)[0]
      : videoUrl.searchParams.get('v')
        || videoUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?controls=1&rel=0` : null;
  } catch {
    return null;
  }
};

export const VideoPlayer = ({ url, title, lessonId, theaterMode = false }: VideoPlayerProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [useYouTubeFallback, setUseYouTubeFallback] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(url);

  const objectId = `${URLS.BASE}/units/${lessonId}/video`;
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

  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const media = event.currentTarget;
    const currentPlayed = media.duration > 0 ? media.currentTime / media.duration : 0;
    if (!Number.isFinite(currentPlayed)) return;

    setPlayed(currentPlayed);
    const milestones = [0.25, 0.5, 0.75, 0.9];
    const prevPlayed = played;
    milestones.forEach(m => {
        if (prevPlayed < m && currentPlayed >= m) {
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

  const handleDurationChange = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(event.currentTarget.duration);
  };

  React.useEffect(() => {
    if (!youtubeEmbedUrl) return;

    const handleYouTubeApiRejection = (event: PromiseRejectionEvent) => {
      const rejectedScript = event.reason instanceof Event ? event.reason.target : null;
      if (!(rejectedScript instanceof HTMLScriptElement) || !/youtube(?:-nocookie)?\.com\/iframe_api/i.test(rejectedScript.src)) {
        return;
      }

      event.preventDefault();
      setUseYouTubeFallback(true);
      setIsReady(true);
    };

    window.addEventListener('unhandledrejection', handleYouTubeApiRejection);
    return () => window.removeEventListener('unhandledrejection', handleYouTubeApiRejection);
  }, [youtubeEmbedUrl]);

  return (
    <div className={theaterMode
      ? 'relative h-full w-full overflow-hidden bg-black'
      : 'relative group aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl animate-in fade-in zoom-in duration-700'}>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}
      
      {useYouTubeFallback && youtubeEmbedUrl ? (
        <iframe
          src={youtubeEmbedUrl}
          title={title}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : playerError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <p>Video could not be loaded.</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-sm underline">Open video on YouTube</a>
        </div>
      ) : (
        <ReactPlayer
          src={url}
          width="100%"
          height="100%"
          playing={playing}
          controls
          onReady={() => setIsReady(true)}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onDurationChange={handleDurationChange}
          onError={() => youtubeEmbedUrl ? setUseYouTubeFallback(true) : setPlayerError(true)}
        />
      )}

      {/* Premium Overlay for Play/Pause when not using native controls (optional) */}
      {!theaterMode && !playing && isReady && (
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
