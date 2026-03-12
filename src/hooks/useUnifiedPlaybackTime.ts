"use client";

import { useState, useEffect, useCallback, useRef, RefObject } from "react";
import Hls from "hls.js";
import type { UnifiedTimeline, MediaSegment } from "@/lib/types";

const LIVE_THRESHOLD_SECONDS = 15;

export interface UnifiedPlaybackState {
  /** Current wall-clock time being viewed (epoch ms). */
  wallClockTime: number | null;
  /** Whether the viewer is at the live edge. */
  isLive: boolean;
  /** Index of the currently playing segment in timeline.segments. */
  currentSegmentIndex: number;
  /** Position within the unified VOD timeline (seconds). */
  globalPosition: number;
}

interface UseUnifiedPlaybackTimeOptions {
  timeline: UnifiedTimeline | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsRef: RefObject<Hls | null>;
  onStreamSwitch: (
    segment: MediaSegment,
    seekToSeconds: number
  ) => void;
}

/**
 * Given a global position (seconds across all VOD segments),
 * find which segment it falls in and the local offset within that segment.
 */
function resolvePosition(
  timeline: UnifiedTimeline,
  globalPos: number
): { segmentIndex: number; localOffset: number } {
  let accumulated = 0;
  for (let i = 0; i < timeline.segments.length; i++) {
    const seg = timeline.segments[i];
    if (seg.isLive) continue; // live segment is at the end, not part of VOD scrub range
    if (globalPos < accumulated + seg.duration) {
      return { segmentIndex: i, localOffset: globalPos - accumulated };
    }
    accumulated += seg.duration;
  }
  // Past the end of all VODs — clamp to end of last VOD
  const lastVodIdx = timeline.segments.findLastIndex((s) => !s.isLive);
  if (lastVodIdx >= 0) {
    const last = timeline.segments[lastVodIdx];
    return { segmentIndex: lastVodIdx, localOffset: last.duration };
  }
  return { segmentIndex: 0, localOffset: 0 };
}

/**
 * Given a segment index and a local offset, compute the global position
 * (seconds from the start of the unified VOD timeline).
 */
function computeGlobalPosition(
  timeline: UnifiedTimeline,
  segmentIndex: number,
  localOffset: number
): number {
  let pos = 0;
  for (let i = 0; i < segmentIndex; i++) {
    const seg = timeline.segments[i];
    if (!seg.isLive) pos += seg.duration;
  }
  return pos + localOffset;
}

function getLiveEdge(
  video: HTMLVideoElement,
  hls: Hls | null
): number | null {
  if (hls?.liveSyncPosition) return hls.liveSyncPosition;
  if (video.seekable.length > 0)
    return video.seekable.end(video.seekable.length - 1);
  return null;
}

export function useUnifiedPlaybackTime({
  timeline,
  videoRef,
  hlsRef,
  onStreamSwitch,
}: UseUnifiedPlaybackTimeOptions) {
  const [state, setState] = useState<UnifiedPlaybackState>({
    wallClockTime: null,
    isLive: false,
    currentSegmentIndex: 0,
    globalPosition: 0,
  });

  const currentSegmentIndexRef = useRef(0);

  // Keep ref in sync
  useEffect(() => {
    currentSegmentIndexRef.current = state.currentSegmentIndex;
  }, [state.currentSegmentIndex]);

  // Track playback position from the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !timeline) return;

    const update = () => {
      const idx = currentSegmentIndexRef.current;
      const segment = timeline.segments[idx];
      if (!segment) return;

      if (segment.isLive) {
        // Live segment: compute wall-clock from live edge offset
        const liveEdge = getLiveEdge(video, hlsRef.current);
        if (liveEdge == null) {
          setState((prev) => ({ ...prev, wallClockTime: null, isLive: true }));
          return;
        }
        const offsetSeconds = liveEdge - video.currentTime;
        const isLive = offsetSeconds < LIVE_THRESHOLD_SECONDS;
        const wallClockTime = Date.now() - offsetSeconds * 1000;
        const globalPosition = timeline.totalVodDuration; // live is after all VODs
        setState({ wallClockTime, isLive, currentSegmentIndex: idx, globalPosition });
      } else {
        // VOD segment: compute wall-clock from segment startTime + local offset
        const localOffset = video.currentTime;
        const wallClockTime = segment.startTime + localOffset * 1000;
        const globalPosition = computeGlobalPosition(timeline, idx, localOffset);
        setState({
          wallClockTime,
          isLive: false,
          currentSegmentIndex: idx,
          globalPosition,
        });
      }
    };

    video.addEventListener("timeupdate", update);
    video.addEventListener("seeking", update);
    video.addEventListener("seeked", update);
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeking", update);
      video.removeEventListener("seeked", update);
    };
  }, [videoRef, hlsRef, timeline]);

  const seekToGlobalPosition = useCallback(
    (seconds: number) => {
      if (!timeline) return;
      const { segmentIndex, localOffset } = resolvePosition(timeline, seconds);
      const segment = timeline.segments[segmentIndex];
      if (!segment) return;

      if (segmentIndex !== currentSegmentIndexRef.current) {
        currentSegmentIndexRef.current = segmentIndex;
        setState((prev) => ({ ...prev, currentSegmentIndex: segmentIndex }));
        onStreamSwitch(segment, localOffset);
      } else {
        // Same segment — just seek within it
        const video = videoRef.current;
        if (video) video.currentTime = localOffset;
      }
    },
    [timeline, onStreamSwitch, videoRef]
  );

  const goLive = useCallback(() => {
    if (!timeline?.currentLiveSegment) return;
    const liveIdx = timeline.segments.findIndex((s) => s.isLive);
    if (liveIdx < 0) return;

    if (liveIdx !== currentSegmentIndexRef.current) {
      currentSegmentIndexRef.current = liveIdx;
      setState((prev) => ({ ...prev, currentSegmentIndex: liveIdx, isLive: true }));
      onStreamSwitch(timeline.currentLiveSegment, -1); // -1 signals "go to live edge"
    } else {
      // Already on live segment — seek to live edge
      const video = videoRef.current;
      const liveEdge = video ? getLiveEdge(video, hlsRef.current) : null;
      if (video && liveEdge != null) video.currentTime = liveEdge;
    }
  }, [timeline, onStreamSwitch, videoRef, hlsRef]);

  const setCurrentSegmentIndex = useCallback((index: number) => {
    currentSegmentIndexRef.current = index;
    setState((prev) => ({ ...prev, currentSegmentIndex: index }));
  }, []);

  return {
    ...state,
    seekToGlobalPosition,
    goLive,
    setCurrentSegmentIndex,
  };
}
