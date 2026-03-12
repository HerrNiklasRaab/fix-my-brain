"use client";

import { ReactNode, RefObject } from "react";
import { useVideoControls } from "@/hooks/useVideoControls";
import LiveBadge from "@/components/LiveBadge";

interface MobileVideoControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isLive: boolean;
  onGoLive?: () => void;
  onGoVod?: () => void;
  timeLabel?: string;
  children: ReactNode;
}

export default function MobileVideoControls({
  videoRef,
  containerRef,
  isLive,
  onGoLive,
  onGoVod,
  timeLabel,
  children,
}: MobileVideoControlsProps) {
  const {
    isPlaying,
    isMuted,
    visible,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    toggleVisible,
  } = useVideoControls({ videoRef, containerRef });

  return (
    <div
      className="absolute inset-0"
      onClick={(e) => {
        // Tap on video area toggles controls visibility, not play/pause
        if (e.target === e.currentTarget) toggleVisible();
      }}
    >
      {/* Top-right: Live toggle */}
      <div
        className={`absolute top-3 right-3 z-10 transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <LiveBadge isLive={isLive} onGoLive={onGoLive} />
      </div>

      {/* Centered Play/Pause */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <button onClick={togglePlay} className={`cursor-pointer rounded-full bg-black/50 p-4 text-white ${visible ? "pointer-events-auto" : "pointer-events-none"}`}>
          {isPlaying ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom controls bar */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Timeline */}
        <div className="mb-1.5">{children}</div>

        {/* Button row: mute left, time center, fullscreen right */}
        <div className="relative flex items-center px-0.5">
          <button onClick={toggleMute} className="cursor-pointer text-white">
            {isMuted ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M15.54 8.46a5 5 0 010 7.07" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>

          {/* Centered time label */}
          {timeLabel && (
            <span className="absolute left-1/2 -translate-x-1/2 text-xs font-mono text-neutral-400">
              {timeLabel}
            </span>
          )}

          <div className="flex-1" />

          <button onClick={toggleFullscreen} className="cursor-pointer text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
