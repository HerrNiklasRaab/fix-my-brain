import { NextRequest, NextResponse } from "next/server";

const FASTPIX_BASE = "https://api.fastpix.io/v1";
const PLAYLIST_REF_ID = "fixmybrain";
const HLS_CONTENT_TYPE = "application/vnd.apple.mpegurl";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface MediaInfo {
  playbackId: string;
  startTime: number; // epoch ms
  duration: number; // seconds
  isLive: boolean;
}

interface VariantInfo {
  bandwidth: number;
  resolution: string;
  codecs: string;
  frameRate: string;
  mediaPlaylistUrl: string;
  streamInfLine: string;
}

interface AudioInfo {
  mediaLine: string;
  mediaPlaylistUrl: string;
}

interface MediaPlaylistData {
  version: string;
  targetDuration: number;
  mapUri: string | null;
  segments: string[]; // raw lines: alternating #EXTINF + URL pairs
}

// ---------------------------------------------------------------------------
// In-memory cache — VOD data doesn't change, so we cache aggressively.
// ---------------------------------------------------------------------------

interface VodCacheEntry {
  vods: MediaInfo[];
  // Per-VOD parsed media playlists, keyed by "playbackId:audio|video:variantIdx"
  parsedPlaylists: Map<string, MediaPlaylistData>;
  variantInfo: { variants: VariantInfo[]; hasAudio: boolean };
  fetchedAt: number;
}

let vodCache: VodCacheEntry | null = null;
const VOD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache stitched manifest output — avoids rebuilding 7000+ line strings every poll
const stitchedCache = new Map<string, { body: string; builtAt: number }>();
const STITCHED_CACHE_TTL = 2_000; // 2 seconds

// ---------------------------------------------------------------------------
// FastPix API helpers
// ---------------------------------------------------------------------------

function getAuthHeader(): string {
  const id = process.env.FASTPIX_TOKEN_ID;
  const secret = process.env.FASTPIX_SECRET_KEY;
  if (!id || !secret) throw new Error("FastPix credentials not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function fpFetch(path: string, revalidate = 30) {
  const res = await fetch(`${FASTPIX_BASE}${path}`, {
    headers: { Authorization: getAuthHeader() },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`FastPix ${res.status}: ${path}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${res.status}: ${url}`);
  const text = await res.text();
  if (!text.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`Not a valid HLS manifest: ${url}`);
  }
  return text;
}

function parseDuration(dur: string | number | null | undefined): number {
  if (dur == null) return 0;
  if (typeof dur === "number") return dur;
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(dur) || 0;
}

// ---------------------------------------------------------------------------
// Data fetching: playlist discovery
// ---------------------------------------------------------------------------

async function findPlaylistId(): Promise<string | null> {
  let offset = 1;
  while (true) {
    const res = await fpFetch(`/on-demand/playlists/?limit=50&offset=${offset}`);
    const list = res.data ?? [];
    for (const pl of list) {
      if (pl.referenceId === PLAYLIST_REF_ID) return pl.id;
    }
    if (list.length < 50) return null;
    offset += 50;
  }
}

async function getPlaylistMedia(playlistId: string): Promise<MediaInfo[]> {
  const res = await fpFetch(`/on-demand/playlists/${playlistId}`);
  const mediaList: any[] = res.data?.mediaList ?? [];

  const ready = mediaList.filter(
    (m) => m.status === "ready" || m.status === "Ready"
  );

  const detailed = await Promise.all(
    ready.map(async (m) => {
      try {
        return (await fpFetch(`/on-demand/${m.id}`)).data;
      } catch {
        return null;
      }
    })
  );

  return detailed
    .filter((m): m is any => m?.playbackIds?.[0]?.id)
    .map((m) => ({
      playbackId: m.playbackIds[0].id,
      startTime: new Date(m.createdAt).getTime() - parseDuration(m.duration) * 1000,
      duration: parseDuration(m.duration),
      isLive: false,
    }))
    .sort((a, b) => a.startTime - b.startTime);
}

// ---------------------------------------------------------------------------
// Cached VOD data fetching
// ---------------------------------------------------------------------------

async function getVodCache(): Promise<VodCacheEntry> {
  if (vodCache && Date.now() - vodCache.fetchedAt < VOD_CACHE_TTL) {
    return vodCache;
  }

  const playlistId = await findPlaylistId();
  const vods = playlistId ? await getPlaylistMedia(playlistId) : [];

  // Fetch & parse all VOD master + media playlists upfront
  const parsedPlaylists = new Map<string, MediaPlaylistData>();
  let variantInfo: { variants: VariantInfo[]; hasAudio: boolean } = {
    variants: [],
    hasAudio: false,
  };

  for (const vod of vods) {
    const masterUrl = `https://stream.fastpix.io/${vod.playbackId}.m3u8`;
    try {
      const masterText = await fetchText(masterUrl);
      const { variants, audio } = parseMasterPlaylist(masterText);

      // Use first VOD's variant info as the reference
      if (variantInfo.variants.length === 0) {
        variantInfo = { variants, hasAudio: !!audio };
      }

      // Parse each video variant playlist
      for (let vi = 0; vi < variants.length; vi++) {
        const key = `${vod.playbackId}:video:${vi}`;
        try {
          const text = await fetchText(variants[vi].mediaPlaylistUrl);
          parsedPlaylists.set(key, parseMediaPlaylist(text, variants[vi].mediaPlaylistUrl));
        } catch {
          // skip broken variant
        }
      }

      // Parse audio playlist
      if (audio) {
        const key = `${vod.playbackId}:audio:0`;
        try {
          const text = await fetchText(audio.mediaPlaylistUrl);
          parsedPlaylists.set(key, parseMediaPlaylist(text, audio.mediaPlaylistUrl));
        } catch {
          // skip broken audio
        }
      }
    } catch {
      // skip broken VOD
    }
  }

  vodCache = { vods, parsedPlaylists, variantInfo, fetchedAt: Date.now() };
  return vodCache;
}

// ---------------------------------------------------------------------------
// HLS manifest parsing helpers
// ---------------------------------------------------------------------------

function parseMasterPlaylist(
  text: string
): { variants: VariantInfo[]; audio: AudioInfo | null } {
  const lines = text.split("\n");
  const variants: VariantInfo[] = [];
  let audio: AudioInfo | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=AUDIO")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        audio = { mediaLine: line, mediaPlaylistUrl: uriMatch[1] };
      }
    }

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const url = lines[i + 1]?.trim();
      if (!url || url.startsWith("#")) continue;

      const bw = line.match(/BANDWIDTH=(\d+)/)?.[1] ?? "0";
      const res = line.match(/RESOLUTION=([^\s,]+)/)?.[1] ?? "";
      const codecs = line.match(/CODECS="([^"]+)"/)?.[1] ?? "";
      const fr = line.match(/FRAME-RATE=([\d.]+)/)?.[1] ?? "";

      variants.push({
        bandwidth: parseInt(bw),
        resolution: res,
        codecs,
        frameRate: fr,
        mediaPlaylistUrl: url,
        streamInfLine: line,
      });
    }
  }

  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return { variants, audio };
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function parseMediaPlaylist(
  text: string,
  manifestUrl?: string
): MediaPlaylistData {
  const lines = text.split("\n");
  let version = "7";
  let targetDuration = 4;
  let mapUri: string | null = null;
  const segments: string[] = [];

  const vars: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXT-X-DEFINE:")) {
      const nameMatch = trimmed.match(/NAME="([^"]+)"/);
      const valueMatch = trimmed.match(/VALUE="([^"]+)"/);
      if (nameMatch && valueMatch) {
        vars[nameMatch[1]] = valueMatch[1];
      }
    }
  }

  const resolveVars = (s: string): string =>
    s.replace(/\{\$([^}]+)\}/g, (_, name) => vars[name] ?? `{$${name}}`);

  const base = manifestUrl ?? "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-VERSION:")) {
      version = line.split(":")[1];
    } else if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      targetDuration = parseInt(line.split(":")[1]) || 4;
    } else if (line.startsWith("#EXT-X-MAP:")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        mapUri = resolveUrl(resolveVars(uriMatch[1]), base);
      }
    } else if (line.startsWith("#EXTINF:")) {
      const url = lines[i + 1]?.trim();
      if (url && !url.startsWith("#")) {
        const resolved = resolveUrl(resolveVars(url), base);
        segments.push(line, resolved);
        i++;
      }
    }
  }

  return { version, targetDuration, mapUri, segments };
}

// ---------------------------------------------------------------------------
// Manifest generation
// ---------------------------------------------------------------------------

function generateMasterPlaylist(
  variants: VariantInfo[],
  hasAudio: boolean,
  baseUrl: string
): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:5", "#EXT-X-INDEPENDENT-SEGMENTS"];

  if (hasAudio) {
    lines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,URI="${baseUrl}/audio.m3u8",GROUP-ID="default-audio-group",NAME="default",LANGUAGE="und",AUTOSELECT=YES,DEFAULT=NO,FORCED=NO,CHANNELS="2"`
    );
  }

  variants.forEach((v, i) => {
    let inf = `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},AVERAGE-BANDWIDTH=${v.bandwidth},CODECS="${v.codecs}",RESOLUTION=${v.resolution},FRAME-RATE=${v.frameRate},VIDEO-RANGE=SDR`;
    if (hasAudio) inf += `,AUDIO="default-audio-group"`;
    inf += `,CLOSED-CAPTIONS=NONE`;
    lines.push(inf);
    lines.push(`${baseUrl}/stream_${i}.m3u8`);
  });

  return lines.join("\n") + "\n";
}

function generateStitchedMediaPlaylist(
  cache: VodCacheEntry,
  variantIndex: number,
  isAudio: boolean
): string {
  const mediaPlaylists: MediaPlaylistData[] = [];
  let maxTargetDuration = 4;

  for (const vod of cache.vods) {
    const key = `${vod.playbackId}:${isAudio ? "audio" : "video"}:${isAudio ? 0 : variantIndex}`;
    const pl = cache.parsedPlaylists.get(key);
    if (pl) {
      mediaPlaylists.push(pl);
      maxTargetDuration = Math.max(maxTargetDuration, pl.targetDuration);
    }
  }

  if (mediaPlaylists.length === 0) return "";

  const lines = [
    "#EXTM3U",
    `#EXT-X-VERSION:7`,
    `#EXT-X-TARGETDURATION:${maxTargetDuration}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
  ];

  for (let i = 0; i < mediaPlaylists.length; i++) {
    const pl = mediaPlaylists[i];

    if (i > 0) {
      lines.push("#EXT-X-DISCONTINUITY");
    }

    if (pl.mapUri) {
      lines.push(`#EXT-X-MAP:URI="${pl.mapUri}"`);
    }

    lines.push(...pl.segments);
  }

  lines.push("#EXT-X-ENDLIST");

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Cached stitching — avoids rebuilding 7000+ line manifest every poll
// ---------------------------------------------------------------------------

function cachedStitch(
  key: string,
  cache: VodCacheEntry,
  variantIndex: number,
  isAudio: boolean
): string {
  const entry = stitchedCache.get(key);
  if (entry && Date.now() - entry.builtAt < STITCHED_CACHE_TTL) {
    return entry.body;
  }
  const body = generateStitchedMediaPlaylist(cache, variantIndex, isAudio);
  stitchedCache.set(key, { body, builtAt: Date.now() });
  return body;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const t0 = Date.now();
    const { path } = await params;
    const filename = path.join("/");

    const cache = await getVodCache();
    const t1 = Date.now();

    console.log(`[DEBUG] ${filename}: cache=${t1-t0}ms, vods=${cache.vods.length}, cacheAge=${Math.round((Date.now()-cache.fetchedAt)/1000)}s`);

    if (cache.vods.length === 0) {
      return new NextResponse("No media available", { status: 404 });
    }

    // segments.json — metadata for chat sync (VOD only)
    if (filename === "segments.json") {
      const segments = cache.vods.map((m) => {
        let duration = m.duration;
        const key = `${m.playbackId}:video:0`;
        const pl = cache.parsedPlaylists.get(key);
        if (pl) {
          let total = 0;
          for (const line of pl.segments) {
            if (line.startsWith("#EXTINF:")) {
              total += parseFloat(line.split(":")[1]) || 0;
            }
          }
          if (total > 0) duration = total;
        }
        return {
          startTime: m.startTime,
          duration,
          isLive: false,
        };
      });
      return NextResponse.json(segments, {
        headers: { "Cache-Control": "max-age=30" },
      });
    }

    // master.m3u8
    if (filename === "master.m3u8") {
      const { variants, hasAudio } = cache.variantInfo;
      if (variants.length === 0) {
        return new NextResponse("No variants available", { status: 404 });
      }

      const baseUrl = `/api/playlist`;
      const body = generateMasterPlaylist(variants, hasAudio, baseUrl);

      return new NextResponse(body, {
        headers: {
          "Content-Type": HLS_CONTENT_TYPE,
          "Cache-Control": "max-age=30",
        },
      });
    }

    // stream_{n}.m3u8 — all past recordings stitched
    const streamMatch = filename.match(/^stream_(\d+)\.m3u8$/);
    if (streamMatch) {
      const variantIndex = parseInt(streamMatch[1]);
      const body = cachedStitch(`video:${variantIndex}`, cache, variantIndex, false);

      return new NextResponse(body, {
        headers: {
          "Content-Type": HLS_CONTENT_TYPE,
          "Cache-Control": "max-age=30",
        },
      });
    }

    // audio.m3u8
    if (filename === "audio.m3u8") {
      const body = cachedStitch("audio:0", cache, 0, true);

      return new NextResponse(body, {
        headers: {
          "Content-Type": HLS_CONTENT_TYPE,
          "Cache-Control": "max-age=30",
        },
      });
    }

    return new NextResponse("Not found", { status: 404 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[DEBUG 500] ${msg}\n${err instanceof Error ? err.stack : ""}`);
    return new NextResponse(msg, { status: 500 });
  }
}
