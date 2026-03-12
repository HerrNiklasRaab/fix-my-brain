import { NextResponse } from "next/server";
import type { MediaSegment, PlaylistApiResponse } from "@/lib/types";

const FASTPIX_BASE = "https://api.fastpix.io/v1";
const PLAYLIST_REF_ID = "fixmybrain";
const LIVE_STREAM_META_NAME = "fix_my_brain";

function getAuthHeader(): string {
  const id = process.env.FASTPIX_TOKEN_ID;
  const secret = process.env.FASTPIX_SECRET_KEY;
  if (!id || !secret) throw new Error("FastPix credentials not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function fpFetch(path: string) {
  const res = await fetch(`${FASTPIX_BASE}${path}`, {
    headers: { Authorization: getAuthHeader() },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`FastPix API error: ${res.status} ${path}`);
  return res.json();
}

/** Parse "HH:MM:SS" or "MM:SS" duration string to seconds. */
function parseDuration(dur: string | number | null | undefined): number {
  if (dur == null) return 0;
  if (typeof dur === "number") return dur;
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(dur) || 0;
}

async function findPlaylist(): Promise<string | null> {
  let offset = 1;
  const limit = 50;
  while (true) {
    const res = await fpFetch(
      `/on-demand/playlists/?limit=${limit}&offset=${offset}`
    );
    const playlists = res.data ?? [];
    for (const pl of playlists) {
      if (pl.referenceId === PLAYLIST_REF_ID) return pl.id;
    }
    if (playlists.length < limit) return null;
    offset += limit;
  }
}

async function getPlaylistMedia(playlistId: string): Promise<MediaSegment[]> {
  const res = await fpFetch(`/on-demand/playlists/${playlistId}`);
  const mediaList: unknown[] = res.data?.mediaList ?? [];

  // Playlist response doesn't include playbackIds — fetch each media individually
  const readyMedia = mediaList.filter(
    (m: any) => m.status === "ready" || m.status === "Ready"
  );

  const detailed = await Promise.all(
    readyMedia.map(async (m: any) => {
      try {
        const detail = await fpFetch(`/on-demand/${m.id}`);
        return detail.data;
      } catch {
        return null;
      }
    })
  );

  return detailed
    .filter((m): m is any => m != null && m.playbackIds?.[0]?.id)
    .map((m) => {
      const duration = parseDuration(m.duration);
      const startTime = new Date(m.createdAt).getTime();
      return {
        mediaId: m.id,
        playbackId: m.playbackIds[0].id,
        isLive: false,
        duration,
        startTime,
        endTime: startTime + duration * 1000,
        title: m.title || undefined,
      } satisfies MediaSegment;
    })
    .sort((a, b) => a.startTime - b.startTime);
}

async function findActiveLiveStream(): Promise<MediaSegment | null> {
  let offset = 1;
  const limit = 50;
  while (true) {
    const res = await fpFetch(
      `/live/streams?limit=${limit}&offset=${offset}`
    );
    const streams = res.data ?? [];
    for (const s of streams) {
      if (
        s.status === "active" &&
        s.metadata?.livestream_name === LIVE_STREAM_META_NAME
      ) {
        const playbackId = s.playbackIds?.[0]?.id;
        if (!playbackId) continue;
        return {
          mediaId: s.streamId ?? s.id,
          playbackId,
          isLive: true,
          duration: 0,
          startTime: new Date(s.createdAt).getTime(),
          endTime: null,
        };
      }
    }
    if (streams.length < limit) return null;
    offset += limit;
  }
}

export async function GET() {
  try {
    const [playlistId, liveSegment] = await Promise.all([
      findPlaylist(),
      findActiveLiveStream(),
    ]);

    let vodSegments: MediaSegment[] = [];
    if (playlistId) {
      vodSegments = await getPlaylistMedia(playlistId);
    }

    const response: PlaylistApiResponse = { vodSegments, liveSegment };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Playlist API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
