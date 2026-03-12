import { useState, useEffect, useCallback, RefObject } from "react";
import Hls from "hls.js";

interface PlaybackTimeState {
  wallClockTime: number | null;
  isLive: boolean;
}

const LIVE_THRESHOLD_SECONDS = 15;

function getLiveEdge(video: HTMLVideoElement, hls: Hls | null): number | null {
  // Prefer hls.liveSyncPosition, fall back to seekable range end
  if (hls?.liveSyncPosition) return hls.liveSyncPosition;
  if (video.seekable.length > 0) return video.seekable.end(video.seekable.length - 1);
  return null;
}

export function useVideoPlaybackTime(
  videoRef: RefObject<HTMLVideoElement | null>,
  hlsRef: RefObject<Hls | null>
): PlaybackTimeState {
  const [state, setState] = useState<PlaybackTimeState>({
    wallClockTime: null,
    isLive: true,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const liveEdge = getLiveEdge(video, hlsRef.current);
      if (liveEdge == null) {
        setState({ wallClockTime: null, isLive: true });
        return;
      }

      const offsetSeconds = liveEdge - video.currentTime;
      const isLive = offsetSeconds < LIVE_THRESHOLD_SECONDS;
      const wallClockTime = Date.now() - offsetSeconds * 1000;

      setState({ wallClockTime, isLive });
    };

    video.addEventListener("timeupdate", update);
    video.addEventListener("seeking", update);
    video.addEventListener("seeked", update);
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeking", update);
      video.removeEventListener("seeked", update);
    };
  }, [videoRef, hlsRef]);

  return state;
}
