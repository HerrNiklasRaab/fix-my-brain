import { useState, useEffect, useRef, RefObject } from "react";
import Hls from "hls.js";

export interface PlaybackTimeState {
  wallClockTime: number | null;
  segmentStartTime: number | null;
  isLive: boolean;
}

export interface SegmentMeta {
  startTime: number; // epoch ms
  duration: number; // seconds
  isLive: boolean;
}

const LIVE_THRESHOLD_SECONDS = 15;

function getLiveEdge(video: HTMLVideoElement, hls: Hls | null): number | null {
  if (hls?.liveSyncPosition) return hls.liveSyncPosition;
  if (video.seekable.length > 0)
    return video.seekable.end(video.seekable.length - 1);
  return null;
}

/**
 * Map a global playback position (seconds across the stitched VOD manifest)
 * to a wall-clock timestamp using segment metadata.
 */
export function resolveWallClock(
  currentTime: number,
  segments: SegmentMeta[]
): { wallClockTime: number; segmentStartTime: number } | null {
  let accumulated = 0;
  for (const seg of segments) {
    if (seg.isLive) return null;
    if (currentTime < accumulated + seg.duration) {
      const localOffset = currentTime - accumulated;
      return {
        wallClockTime: seg.startTime + localOffset * 1000,
        segmentStartTime: seg.startTime,
      };
    }
    accumulated += seg.duration;
  }
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    if (!last.isLive) {
      return {
        wallClockTime: last.startTime + last.duration * 1000,
        segmentStartTime: last.startTime,
      };
    }
  }
  return null;
}

/**
 * Inverse mapping: wall-clock time → video position + source.
 * Used by the custom timeline to seek the correct video element.
 */
export function resolveVideoPosition(
  wallClockTime: number,
  segments: SegmentMeta[]
): { videoTime: number; source: "vod" | "live" } {
  const vodSegs = segments.filter((s) => !s.isLive);
  let accumulated = 0;
  for (let i = 0; i < vodSegs.length; i++) {
    const seg = vodSegs[i];
    const segEnd = seg.startTime + seg.duration * 1000;

    // In a gap before this segment — snap to its start
    if (wallClockTime < seg.startTime) {
      return { videoTime: accumulated, source: "vod" };
    }

    // Within this segment
    if (wallClockTime < segEnd) {
      const localOffsetMs = wallClockTime - seg.startTime;
      return { videoTime: accumulated + localOffsetMs / 1000, source: "vod" };
    }

    accumulated += seg.duration;
  }

  // Past all VODs → live
  if (segments.some((s) => s.isLive)) {
    return { videoTime: 0, source: "live" };
  }

  // No live stream — clamp to end of last VOD
  return { videoTime: Math.max(0, accumulated - 0.1), source: "vod" };
}

/**
 * Compute the total wall-clock time range covered by all segments.
 * Returns { start, end } in epoch ms — used for timeline rendering.
 */
export function getTimelineRange(segments: SegmentMeta[]): { start: number; end: number } | null {
  if (segments.length === 0) return null;
  const vodSegs = segments.filter((s) => !s.isLive);
  if (vodSegs.length === 0) return null;
  const start = vodSegs[0].startTime;
  const lastVod = vodSegs[vodSegs.length - 1];
  const vodEnd = lastVod.startTime + lastVod.duration * 1000;
  const hasLive = segments.some((s) => s.isLive);
  const end = hasLive ? Date.now() : vodEnd;
  return { start, end };
}

export function useVideoPlaybackTime(
  videoRef: RefObject<HTMLVideoElement | null>,
  hlsRef: RefObject<Hls | null>,
  sourceMode: "vod" | "live" = "vod"
): PlaybackTimeState {
  const [state, setState] = useState<PlaybackTimeState>({
    wallClockTime: null,
    segmentStartTime: null,
    isLive: false,
  });
  const segmentsRef = useRef<SegmentMeta[]>([]);
  const totalVodDurationRef = useRef(0);

  // Fetch segment metadata for wall-clock mapping
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/playlist/segments.json");
        if (!res.ok) return;
        const data: SegmentMeta[] = await res.json();
        if (!cancelled) {
          segmentsRef.current = data;
          totalVodDurationRef.current = data
            .filter((s) => !s.isLive)
            .reduce((sum, s) => sum + s.duration, 0);
        }
      } catch {
        // Ignore — hook falls back to live-edge calculation
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Track playback position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const segments = segmentsRef.current;
      const currentTime = video.currentTime;

      if (sourceMode === "live") {
        const liveEdge = getLiveEdge(video, hlsRef.current);
        if (liveEdge != null) {
          const offsetSeconds = liveEdge - currentTime;
          const isLive = offsetSeconds < LIVE_THRESHOLD_SECONDS;
          const wallClockTime = Date.now() - offsetSeconds * 1000;
          setState({ wallClockTime, segmentStartTime: null, isLive });
        } else {
          setState({ wallClockTime: Date.now(), segmentStartTime: null, isLive: true });
        }
        return;
      }

      const mapped = resolveWallClock(currentTime, segments);
      if (mapped != null) {
        setState({ wallClockTime: mapped.wallClockTime, segmentStartTime: mapped.segmentStartTime, isLive: false });
        return;
      }

      setState({ wallClockTime: null, segmentStartTime: null, isLive: false });
    };

    video.addEventListener("timeupdate", update);
    video.addEventListener("seeking", update);
    video.addEventListener("seeked", update);
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeking", update);
      video.removeEventListener("seeked", update);
    };
  }, [videoRef, hlsRef, sourceMode]);

  return state;
}
