"use client";

interface LiveBadgeProps {
  isLive: boolean;
  onGoLive?: () => void;
}

export default function LiveBadge({ isLive, onGoLive }: LiveBadgeProps) {
  if (!isLive && onGoLive) {
    return (
      <button
        onClick={onGoLive}
        className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-600 bg-neutral-800/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:border-neutral-500 hover:text-neutral-300"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-neutral-500" />
        Go live
      </button>
    );
  }

  if (isLive) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
    );
  }

  return null;
}
