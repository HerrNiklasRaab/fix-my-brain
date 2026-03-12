"use client";

import { useState, useEffect, useRef, useCallback, ReactNode, RefObject } from "react";

interface VideoControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isLive: boolean;
  onGoLive?: () => void;
  onGoVod?: () => void;
  children: ReactNode; // timeline goes here
}

export default function VideoControls({
  videoRef,
  containerRef,
  isLive,
  onGoLive,
  onGoVod,
  children,
}: VideoControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [visible, setVisible] = useState(true);
  const [indicator, setIndicator] = useState<"play" | "pause" | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const indicatorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Track play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Sync initial state
    setIsPlaying(!video.paused);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoRef]);

  // Auto-hide controls after 3s
  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  const showIndicator = useCallback((type: "play" | "pause") => {
    setIndicator(type);
    if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
    indicatorTimerRef.current = setTimeout(() => setIndicator(null), 600);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      showIndicator("play");
    } else {
      video.pause();
      showIndicator("pause");
    }
  }, [videoRef, showIndicator]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [videoRef]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const val = parseFloat(e.target.value);
      video.volume = val;
      video.muted = val === 0;
      setVolume(val);
      setIsMuted(val === 0);
    },
    [videoRef]
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, [containerRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const video = videoRef.current;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (video) video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (video) video.currentTime += 5;
          break;
        case "j":
          e.preventDefault();
          if (video) video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l":
          e.preventDefault();
          if (video) video.currentTime += 10;
          break;
        case "ArrowUp":
          e.preventDefault();
          if (video) {
            video.volume = Math.min(1, video.volume + 0.05);
            video.muted = false;
            setVolume(video.volume);
            setIsMuted(false);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (video) {
            video.volume = Math.max(0, video.volume - 0.05);
            if (video.volume === 0) video.muted = true;
            setVolume(video.volume);
            setIsMuted(video.muted);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoRef, togglePlay, toggleMute, toggleFullscreen]);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        // Click on the video area (not controls) toggles play/pause
        if (e.target === e.currentTarget) togglePlay();
      }}
    >
      {/* Play/Pause indicator */}
      {indicator && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-[indicator-pop_0.6s_ease-out_forwards] rounded-full bg-black/50 p-5">
            {indicator === "play" ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-10 transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Timeline */}
        <div className="mb-2">{children}</div>

        {/* Button row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="cursor-pointer text-white hover:text-neutral-300">
            {isPlaying ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <button onClick={toggleMute} className="cursor-pointer text-white hover:text-neutral-300">
            {isMuted ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M15.54 8.46a5 5 0 010 7.07" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="h-1 w-16 cursor-pointer appearance-none rounded accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{
              background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, #525252 ${(isMuted ? 0 : volume) * 100}%)`,
            }}
          />

          <div className="flex-1" />

          {/* Live toggle */}
          {!isLive && onGoLive && (
            <button
              onClick={onGoLive}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-red-600/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-white" />
              Go live
            </button>
          )}
          {isLive && (
            <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="cursor-pointer text-white hover:text-neutral-300">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,3 21,3 21,9" />
              <polyline points="9,21 3,21 3,15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
