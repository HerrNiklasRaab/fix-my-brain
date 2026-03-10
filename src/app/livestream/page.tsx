"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import ChatPanel from "@/components/ChatPanel";

export default function Livestream() {
  const playbackId = process.env.NEXT_PUBLIC_FASTPIX_PLAYBACK_ID;
  const isConfigured = !!playbackId;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    const src = `https://stream.fastpix.io/${playbackId}.m3u8?dvrMode=true`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 300,
        maxBufferLength: 30,
        liveSyncDurationCount: 3,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }
  }, [playbackId]);

  return (
    <div className="flex h-[calc(100dvh-49px)] flex-col bg-black text-white">
      {/* Video + Chat Row */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Video Player */}
        <div className="aspect-video w-full shrink-0 bg-black md:aspect-auto md:w-auto md:flex-1">
          {isConfigured ? (
            <video
              ref={videoRef}
              className="h-full w-full"
              controls
              muted
              playsInline
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 inline-block border-2 border-neutral-700 px-4 py-1">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">
                    Offline
                  </span>
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-600">
                  No broadcast at this time
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <ChatPanel />
      </div>
    </div>
  );
}
