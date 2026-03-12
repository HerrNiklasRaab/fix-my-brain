"use client";

import { useState, useEffect, useRef, useCallback, RefObject } from "react";

interface UseVideoControlsOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function useVideoControls({ videoRef, containerRef }: UseVideoControlsOptions) {
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
    setIsPlaying(!video.paused);
    const onPlay = () => {
      setIsPlaying(true);
      // Auto-hide controls when playback starts
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    };
    const onPause = () => {
      setIsPlaying(false);
      // Cancel auto-hide timer while paused (but don't force-show controls)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
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
    const video = videoRef.current;
    if (video && !video.paused) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, [videoRef]);

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
    const video = videoRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (video && (video as any).webkitEnterFullscreen) {
      (video as any).webkitEnterFullscreen();
    }
  }, [containerRef, videoRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const toggleVisible = useCallback(() => {
    setVisible((v) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (!v) {
        // Showing controls — auto-hide after 3s only if playing
        const video = videoRef.current;
        if (video && !video.paused) {
          hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
        }
      }
      return !v;
    });
  }, [videoRef]);

  return {
    // State
    isPlaying,
    isMuted,
    volume,
    visible,
    indicator,

    // Actions
    togglePlay,
    toggleMute,
    toggleFullscreen,
    handleVolumeChange,

    // UI helpers
    resetHideTimer,
    toggleVisible,
    showIndicator,
  };
}
