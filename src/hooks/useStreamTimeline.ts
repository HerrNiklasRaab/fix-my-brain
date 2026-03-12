"use client";

import { useState, useEffect, useCallback } from "react";
import type { UnifiedTimeline, PlaylistApiResponse } from "@/lib/types";

const REFRESH_INTERVAL_MS = 60_000;

function buildTimeline(data: PlaylistApiResponse): UnifiedTimeline {
  const segments = [...data.vodSegments];
  if (data.liveSegment) segments.push(data.liveSegment);

  const totalVodDuration = data.vodSegments.reduce(
    (sum, s) => sum + s.duration,
    0
  );

  return {
    segments,
    totalVodDuration,
    currentLiveSegment: data.liveSegment,
  };
}

export function useStreamTimeline() {
  const [timeline, setTimeline] = useState<UnifiedTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/playlist");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: PlaylistApiResponse = await res.json();
      setTimeline(buildTimeline(data));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  return { timeline, isLoading, error, refresh: fetchTimeline };
}
