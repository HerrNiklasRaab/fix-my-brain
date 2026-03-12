"use client";

import { ReactNode, RefObject } from "react";
import { useVideoControls } from "@/hooks/useVideoControls";
import LiveBadge from "@/components/LiveBadge";

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
  const {
    isPlaying,
    isMuted,
    volume,
    visible,
    indicator,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    handleVolumeChange,
    resetHideTimer,
  } = useVideoControls({ videoRef, containerRef });

  return (
    <div
      className="absolute inset-0"
      onMouseMove={resetHideTimer}
      onClick={(e) => {
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

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="cursor-pointer text-white hover:text-neutral-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
