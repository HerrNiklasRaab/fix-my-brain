"use client";

import { useRef, useCallback, useMemo, MouseEvent } from "react";
import { SegmentMeta } from "@/hooks/useVideoPlaybackTime";

interface CustomTimelineProps {
  segments: SegmentMeta[];
  wallClockTime: number | null;
  isLive: boolean;
  onSeek: (wallClockTime: number) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Content-based timeline: width is proportional to actual content duration,
 * wall-clock gaps between segments are collapsed.
 */
export default function CustomTimeline({
  segments,
  wallClockTime,
  isLive,
  onSeek,
}: CustomTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const timeline = useMemo(() => {
    const vodSegs = segments.filter((s) => !s.isLive);
    const hasLive = segments.some((s) => s.isLive);
    if (vodSegs.length === 0 && !hasLive) return null;

    const vodContentMs = vodSegs.reduce((sum, s) => sum + s.duration * 1000, 0);

    // Live portion uses the actual DVR duration from segments.json
    const liveSeg = segments.find((s) => s.isLive);
    const liveContentMs = liveSeg ? liveSeg.duration * 1000 : 0;
    // Live segment's startTime = now - DVR duration (set by server)
    const liveWallClockStart = liveSeg ? liveSeg.startTime : Date.now();

    const totalContentMs = vodContentMs + liveContentMs;
    if (totalContentMs <= 0) return null;

    return { vodSegs, hasLive, vodContentMs, liveContentMs, totalContentMs, liveWallClockStart };
  }, [segments]);

  // Convert wall-clock time → content offset (ms into the collapsed timeline)
  const wallClockToOffset = useCallback(
    (wc: number): number => {
      if (!timeline) return 0;
      const { vodSegs, vodContentMs, liveWallClockStart } = timeline;

      let accumulated = 0;
      for (const seg of vodSegs) {
        const segEnd = seg.startTime + seg.duration * 1000;
        if (wc >= seg.startTime && wc < segEnd) {
          return accumulated + (wc - seg.startTime);
        }
        // If wc is before this segment (in a gap before it), snap to segment start
        if (wc < seg.startTime) {
          return accumulated;
        }
        accumulated += seg.duration * 1000;
      }

      // Past all VODs — in live region (clamp to DVR window to avoid drift)
      if (timeline.hasLive && wc >= liveWallClockStart) {
        const liveOffset = Math.min(wc - liveWallClockStart, timeline.liveContentMs);
        return vodContentMs + liveOffset;
      }

      // In a gap after the last VOD but no live → clamp to end of VOD
      return vodContentMs;
    },
    [timeline]
  );

  // Convert content offset (ms) → wall-clock time
  const offsetToWallClock = useCallback(
    (offset: number): number => {
      if (!timeline) return Date.now();
      const { vodSegs, vodContentMs, liveWallClockStart } = timeline;

      let accumulated = 0;
      for (const seg of vodSegs) {
        const segMs = seg.duration * 1000;
        if (offset < accumulated + segMs) {
          return seg.startTime + (offset - accumulated);
        }
        accumulated += segMs;
      }

      // In live region
      if (timeline.hasLive) {
        return liveWallClockStart + (offset - vodContentMs);
      }

      // Clamp to end of last VOD
      const lastSeg = vodSegs[vodSegs.length - 1];
      return lastSeg ? lastSeg.startTime + lastSeg.duration * 1000 : Date.now();
    },
    [timeline]
  );

  const getWallClockFromEvent = useCallback(
    (e: MouseEvent | globalThis.MouseEvent) => {
      const bar = barRef.current;
      if (!bar || !timeline) return null;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const contentOffset = fraction * timeline.totalContentMs;
      return offsetToWallClock(contentOffset);
    },
    [timeline, offsetToWallClock]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      isDraggingRef.current = true;
      const wc = getWallClockFromEvent(e);
      if (wc != null) onSeek(wc);

      const handleMouseMove = (e: globalThis.MouseEvent) => {
        if (!isDraggingRef.current) return;
        const wc = getWallClockFromEvent(e);
        if (wc != null) onSeek(wc);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [getWallClockFromEvent, onSeek]
  );

  // Early return after all hooks
  if (!timeline) return null;

  const { vodSegs, hasLive, vodContentMs, totalContentMs } = timeline;

  // Playhead position in content-space
  const playheadFraction =
    wallClockTime != null
      ? Math.max(0, Math.min(1, wallClockToOffset(wallClockTime) / totalContentMs))
      : 0;


  const elapsed = wallClockTime != null ? wallClockToOffset(wallClockTime) : 0;
  const elapsedLabel = formatDuration(Math.max(0, elapsed));
  const totalLabel = formatDuration(totalContentMs);

  return (
    <div className="flex w-full items-center gap-3">
      <div
        ref={barRef}
        className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-neutral-800 transition-[height] hover:h-2.5"
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white"
          style={{ width: `${playheadFraction * 100}%` }}
        />

        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
          style={{ left: `${playheadFraction * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-mono text-neutral-400">
        {elapsedLabel} / {totalLabel}
      </span>
    </div>
  );
}
