"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Hls from "hls.js";
import ChatPanel from "@/components/ChatPanel";
import CustomTimeline from "@/components/CustomTimeline";
import VideoControls from "@/components/VideoControls";
import {
  useVideoPlaybackTime,
  resolveVideoPosition,
  SegmentMeta,
} from "@/hooks/useVideoPlaybackTime";

type SourceMode = "vod" | "live";

const VOD_SRC = "/api/playlist/master.m3u8";
const LIVE_PLAYBACK_ID = process.env.NEXT_PUBLIC_FASTPIX_LIVE_PLAYBACK_ID;
const LIVE_SRC = LIVE_PLAYBACK_ID
  ? `https://stream.fastpix.io/${LIVE_PLAYBACK_ID}.m3u8?dvrMode=true`
  : null;

export default function Livestream() {
  const vodVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const hlsVodRef = useRef<Hls | null>(null);
  const hlsLiveRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSource, setActiveSource] = useState<SourceMode>("vod");
  const [hasLiveStream, setHasLiveStream] = useState(false);
  const [vodSegments, setVodSegments] = useState<SegmentMeta[]>([]);
  const [liveDvrDuration, setLiveDvrDuration] = useState(0);
  const activeSourceRef = useRef<SourceMode>("vod");

  // Combine VOD segments with a synthetic live segment
  const segments = useMemo<SegmentMeta[]>(() => {
    if (!hasLiveStream || liveDvrDuration <= 0) return vodSegments;
    // Live DVR window: [now - dvrDuration, now]
    // Gap between VOD end and DVR start is collapsed by the timeline
    const start = Date.now() - liveDvrDuration * 1000;
    return [
      ...vodSegments,
      { startTime: start, duration: liveDvrDuration, isLive: true },
    ];
  }, [vodSegments, hasLiveStream, liveDvrDuration]);

  // Track which video is active for the playback time hook
  const activeVideoRef = activeSource === "live" ? liveVideoRef : vodVideoRef;
  const activeHlsRef = activeSource === "live" ? hlsLiveRef : hlsVodRef;

  const { wallClockTime, segmentStartTime, isLive } = useVideoPlaybackTime(
    activeVideoRef,
    activeHlsRef,
    activeSource
  );

  activeSourceRef.current = activeSource;

  // Poll segments.json (VOD segments only)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/playlist/segments.json");
        if (!res.ok || cancelled) return;
        const data: SegmentMeta[] = await res.json();
        if (!cancelled) {
          setVodSegments(data);
        }
      } catch {
        // ignore
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Initialize VOD HLS
  useEffect(() => {
    const video = vodVideoRef.current;
    if (!video || !Hls.isSupported()) return;

    const hls = new Hls({
      lowLatencyMode: false,
      backBufferLength: 300,
      maxBufferLength: 30,
    });
    hlsVodRef.current = hls;
    hls.loadSource(VOD_SRC);
    hls.attachMedia(video);

    return () => {
      hlsVodRef.current = null;
      hls.destroy();
    };
  }, []);

  // Initialize Live HLS (only when LIVE_SRC is configured)
  useEffect(() => {
    if (!LIVE_SRC) return;
    const video = liveVideoRef.current;
    if (!video || !Hls.isSupported()) return;

    const hls = new Hls({
      lowLatencyMode: false,
      backBufferLength: 60,
      maxBufferLength: 30,
    });
    hlsLiveRef.current = hls;
    hls.loadSource(LIVE_SRC);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setHasLiveStream(true);
      if (activeSourceRef.current === "vod") {
        switchTo("live");
      }
    });
    // Update DVR duration from the full playlist duration (includes pre-existing DVR buffer)
    hls.on(Hls.Events.LEVEL_UPDATED, (_event, data) => {
      if (data.details.totalduration > 0) {
        setLiveDvrDuration(data.details.totalduration);
      }
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setHasLiveStream(false);
        setLiveDvrDuration(0);
      }
    });

    return () => {
      hlsLiveRef.current = null;
      hls.destroy();
    };
  }, []);

  // Switch active source
  const switchTo = useCallback((mode: SourceMode) => {
    const vodVideo = vodVideoRef.current;
    const liveVideo = liveVideoRef.current;
    if (!vodVideo) return;

    if (mode === "live" && liveVideo) {
      vodVideo.pause();
      liveVideo.play().catch(() => {});
      // Seek to live edge
      const hls = hlsLiveRef.current;
      if (hls?.liveSyncPosition) {
        liveVideo.currentTime = hls.liveSyncPosition;
      } else if (liveVideo.seekable.length > 0) {
        liveVideo.currentTime = liveVideo.seekable.end(liveVideo.seekable.length - 1);
      }
    } else {
      liveVideo?.pause();
      vodVideo.play().catch(() => {});
    }

    setActiveSource(mode);
    activeSourceRef.current = mode;
  }, []);

  // Handle seek from custom timeline
  const handleSeek = useCallback(
    (targetWallClock: number) => {
      const { videoTime, source } = resolveVideoPosition(targetWallClock, segments);

      if (source === "vod") {
        const vodVideo = vodVideoRef.current;
        if (!vodVideo) return;
        if (activeSourceRef.current === "live") {
          liveVideoRef.current?.pause();
          setActiveSource("vod");
          activeSourceRef.current = "vod";
        }
        vodVideo.currentTime = videoTime;
        vodVideo.play().catch(() => {});
      } else {
        // Live — compute DVR offset
        const liveVideo = liveVideoRef.current;
        const hls = hlsLiveRef.current;
        if (!liveVideo || !hls) return;

        if (activeSourceRef.current === "vod") {
          vodVideoRef.current?.pause();
          setActiveSource("live");
          activeSourceRef.current = "live";
        }

        const secondsAgo = (Date.now() - targetWallClock) / 1000;
        const liveEdge =
          hls.liveSyncPosition ??
          (liveVideo.seekable.length > 0
            ? liveVideo.seekable.end(liveVideo.seekable.length - 1)
            : null);

        if (liveEdge != null) {
          liveVideo.currentTime = Math.max(0, liveEdge - secondsAgo);
        }
        liveVideo.play().catch(() => {});
      }
    },
    [segments]
  );

  // Go to live edge
  const goLive = useCallback(() => {
    switchTo("live");
  }, [switchTo]);

  // Go back to VOD (resume from end of last VOD segment)
  const goVod = useCallback(() => {
    switchTo("vod");
  }, [switchTo]);

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Video Player Container */}
        <div
          ref={containerRef}
          className="relative aspect-video w-full min-h-0 bg-black md:aspect-auto md:w-auto md:flex-1"
        >
          {/* VOD Video */}
          <video
            ref={vodVideoRef}
            className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
              activeSource === "vod" ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
            muted
            playsInline
          />
          {/* Live Video */}
          <video
            ref={liveVideoRef}
            className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
              activeSource === "live" ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
            muted
            playsInline
          />

          {/* Wall-clock overlay */}
          {wallClockTime != null && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded bg-black/60 px-2.5 py-1 text-xs font-mono text-neutral-300">
              {new Date(wallClockTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
              {new Date(wallClockTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          )}

          {/* Custom Controls */}
          <div className="absolute inset-0 z-20">
            <VideoControls
              videoRef={activeVideoRef}
              containerRef={containerRef}
              isLive={isLive}
              onGoLive={hasLiveStream ? goLive : undefined}
              onGoVod={hasLiveStream ? goVod : undefined}
            >
              <CustomTimeline
                segments={segments}
                wallClockTime={wallClockTime}
                isLive={isLive}
                onSeek={handleSeek}
              />
            </VideoControls>
          </div>
        </div>

        {/* Chat Panel */}
        <ChatPanel
          wallClockTime={wallClockTime}
          segmentStartTime={segmentStartTime}
          isLive={isLive}
        />
      </div>
    </div>
  );
}
