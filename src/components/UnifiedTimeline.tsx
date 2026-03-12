"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { UnifiedTimeline as UnifiedTimelineType } from "@/lib/types";

interface Props {
  timeline: UnifiedTimelineType;
  globalPosition: number;
  isLive: boolean;
  isLoading?: boolean;
  onSeek: (globalSeconds: number) => void;
  onGoLive: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UnifiedTimeline({
  timeline,
  globalPosition,
  isLive,
  isLoading,
  onSeek,
  onGoLive,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const totalDuration = timeline.totalVodDuration;
  const progressPct = totalDuration > 0
    ? Math.min((globalPosition / totalDuration) * 100, 100)
    : 0;

  const getPctFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    []
  );

  const handleSeek = useCallback(
    (pct: number) => {
      onSeek(pct * totalDuration);
    },
    [onSeek, totalDuration]
  );

  // Mouse down on bar
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (totalDuration <= 0) return;
      setIsDragging(true);
      const pct = getPctFromEvent(e);
      handleSeek(pct);
    },
    [getPctFromEvent, handleSeek, totalDuration]
  );

  // Global mouse move/up for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const pct = getPctFromEvent(e);
      handleSeek(pct);
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging, getPctFromEvent, handleSeek]);

  // Hover tooltip position
  const hoverSeconds = hoverPct != null ? hoverPct * totalDuration : null;

  // Find which segment the hover falls in for the tooltip
  let hoverWallClock: number | null = null;
  let hoverSegmentTitle: string | null = null;
  if (hoverSeconds != null) {
    let accumulated = 0;
    for (const seg of timeline.segments) {
      if (seg.isLive) continue;
      if (hoverSeconds < accumulated + seg.duration) {
        const localOffset = hoverSeconds - accumulated;
        hoverWallClock = seg.startTime + localOffset * 1000;
        hoverSegmentTitle = seg.title || null;
        break;
      }
      accumulated += seg.duration;
    }
  }

  // Compute segment boundaries for visual markers
  const segmentBoundaries: number[] = [];
  {
    let accumulated = 0;
    for (const seg of timeline.segments) {
      if (seg.isLive) continue;
      accumulated += seg.duration;
      if (totalDuration > 0) {
        segmentBoundaries.push((accumulated / totalDuration) * 100);
      }
    }
    segmentBoundaries.pop(); // Remove last (100%) since it's the end
  }

  return (
    <div className="flex items-center gap-3 bg-neutral-900 px-3 py-2">
      {/* Time display */}
      <span className="min-w-[4rem] text-right font-mono text-xs text-neutral-400">
        {formatTime(globalPosition)}
      </span>

      {/* Scrub bar */}
      <div
        ref={barRef}
        className="group relative flex-1 cursor-pointer py-1"
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => setHoverPct(getPctFromEvent(e))}
        onMouseLeave={() => setHoverPct(null)}
      >
        {/* Track background */}
        <div className="relative h-2 rounded-full bg-neutral-700">
          {/* Segment boundary markers */}
          {segmentBoundaries.map((pct, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-0.5 bg-neutral-500"
              style={{ left: `${pct}%` }}
            />
          ))}

          {/* Progress fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-red-600 transition-[width] duration-100"
            style={{ width: `${isLive ? 100 : progressPct}%` }}
          />

          {/* Playhead */}
          {!isLive && totalDuration > 0 && (
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md opacity-0 transition-opacity group-hover:opacity-100"
              style={{ left: `${progressPct}%` }}
            />
          )}
        </div>

        {/* Hover tooltip */}
        {hoverPct != null && hoverSeconds != null && !isDragging && (
          <div
            className="absolute -top-10 -translate-x-1/2 rounded bg-neutral-800 px-2 py-1 text-xs text-white whitespace-nowrap pointer-events-none"
            style={{ left: `${hoverPct * 100}%` }}
          >
            {hoverSegmentTitle && (
              <span className="mr-1 text-neutral-400">{hoverSegmentTitle}</span>
            )}
            {hoverWallClock ? formatDate(hoverWallClock) : formatTime(hoverSeconds)}
          </div>
        )}
      </div>

      {/* Total duration */}
      <span className="min-w-[4rem] font-mono text-xs text-neutral-400">
        {formatTime(totalDuration)}
      </span>

      {/* Loading indicator */}
      {isLoading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
      )}

      {/* Live button */}
      {timeline.currentLiveSegment && (
        <button
          onClick={onGoLive}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
            isLive
              ? "bg-red-600 text-white"
              : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isLive ? "bg-white animate-pulse" : "bg-red-500"
            }`}
          />
          Live
        </button>
      )}
    </div>
  );
}
