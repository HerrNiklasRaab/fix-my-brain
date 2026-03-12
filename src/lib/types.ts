export interface MediaSegment {
  mediaId: string;
  playbackId: string;
  isLive: boolean;
  /** Duration in seconds. 0 for live segments (duration is unknown). */
  duration: number;
  /** Wall-clock start time (epoch ms), derived from createdAt. */
  startTime: number;
  /** Wall-clock end time (epoch ms). null if currently live. */
  endTime: number | null;
  title?: string;
}

export interface UnifiedTimeline {
  /** All segments in chronological order: playlist VODs + optional live. */
  segments: MediaSegment[];
  /** Sum of all VOD segment durations in seconds. */
  totalVodDuration: number;
  /** The currently active live segment, if any. */
  currentLiveSegment: MediaSegment | null;
}

export interface PlaylistApiResponse {
  vodSegments: MediaSegment[];
  liveSegment: MediaSegment | null;
}
