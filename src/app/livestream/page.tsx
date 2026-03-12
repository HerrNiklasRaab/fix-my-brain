"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Hls from "hls.js";
import ChatPanel from "@/components/ChatPanel";
import UnifiedTimeline from "@/components/UnifiedTimeline";
import { useStreamTimeline } from "@/hooks/useStreamTimeline";
import { useUnifiedPlaybackTime } from "@/hooks/useUnifiedPlaybackTime";
import type { MediaSegment } from "@/lib/types";

export default function Livestream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const { timeline, isLoading } = useStreamTimeline();

  const loadStream = useCallback(
    (segment: MediaSegment, seekToSeconds: number) => {
      const video = videoRef.current;
      if (!video) return;

      // Tear down existing HLS
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      setIsSwitching(true);

      const src = segment.isLive
        ? `https://stream.fastpix.io/${segment.playbackId}.m3u8?dvrMode=true`
        : `https://stream.fastpix.io/${segment.playbackId}.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: segment.isLive,
          backBufferLength: 300,
          maxBufferLength: 30,
          liveSyncDurationCount: 3,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsSwitching(false);
          if (seekToSeconds >= 0) {
            video.currentTime = seekToSeconds;
          }
          // For live with seekTo === -1, HLS auto-syncs to live edge
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, () => {
          setIsSwitching(false);
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener(
          "loadedmetadata",
          () => {
            setIsSwitching(false);
            if (seekToSeconds >= 0) video.currentTime = seekToSeconds;
            video.play().catch(() => {});
          },
          { once: true }
        );
      }
    },
    []
  );

  const {
    wallClockTime,
    isLive,
    currentSegmentIndex,
    globalPosition,
    seekToGlobalPosition,
    goLive,
    setCurrentSegmentIndex,
  } = useUnifiedPlaybackTime({
    timeline,
    videoRef,
    hlsRef,
    onStreamSwitch: loadStream,
  });

  // Load initial stream when timeline first arrives
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!timeline || initialLoadDone.current) return;
    if (timeline.segments.length === 0) return;
    initialLoadDone.current = true;

    // Prefer live, else most recent VOD
    if (timeline.currentLiveSegment) {
      const liveIdx = timeline.segments.findIndex((s) => s.isLive);
      if (liveIdx >= 0) {
        setCurrentSegmentIndex(liveIdx);
        loadStream(timeline.currentLiveSegment, -1);
        return;
      }
    }

    // Last VOD segment
    const lastVodIdx = timeline.segments.findLastIndex((s) => !s.isLive);
    if (lastVodIdx >= 0) {
      setCurrentSegmentIndex(lastVodIdx);
      loadStream(timeline.segments[lastVodIdx], 0);
    }
  }, [timeline, loadStream, setCurrentSegmentIndex]);

  // Auto-advance to next segment when current VOD ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !timeline) return;

    const handleEnded = () => {
      const nextIdx = currentSegmentIndex + 1;
      if (nextIdx < timeline.segments.length) {
        const next = timeline.segments[nextIdx];
        setCurrentSegmentIndex(nextIdx);
        loadStream(next, next.isLive ? -1 : 0);
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [timeline, currentSegmentIndex, loadStream, setCurrentSegmentIndex]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const hasContent = timeline && timeline.segments.length > 0;

  return (
    <div className="flex h-[calc(100dvh-49px)] flex-col bg-black text-white">
      {/* Video + Chat Row */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Video Player */}
        <div className="relative aspect-video w-full shrink-0 bg-black md:aspect-auto md:w-auto md:flex-1">
          {hasContent ? (
            <>
              <video
                ref={videoRef}
                className="h-full w-full hide-timeline"
                controls
                muted
                playsInline
              />
              {/* Loading overlay during stream switch */}
              {isSwitching && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
                </div>
              )}
            </>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 inline-block border-2 border-neutral-700 px-4 py-1">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">
                    Offline
                  </span>
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-600">
                  No recordings available
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <ChatPanel wallClockTime={wallClockTime} isLive={isLive} />
      </div>

      {/* Unified Timeline Scrub Bar */}
      {timeline && timeline.segments.length > 0 && (
        <UnifiedTimeline
          timeline={timeline}
          globalPosition={globalPosition}
          isLive={isLive}
          isLoading={isSwitching}
          onSeek={seekToGlobalPosition}
          onGoLive={goLive}
        />
      )}
    </div>
  );
}
