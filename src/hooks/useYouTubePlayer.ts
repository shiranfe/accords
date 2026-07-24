import { useEffect, useRef, useState } from "react";

export type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT as YTNamespace);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

/** YT.PlayerState values the app cares about. */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

/**
 * Mounts a controllable YouTube player into the returned container ref.
 * `player` is null until the player is ready. `onStateChange` fires with the
 * raw YT.PlayerState number, including for clicks inside the iframe itself.
 */
export function useYouTubePlayer(
  videoId: string | null,
  onStateChange?: (state: number) => void,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    const host = containerRef.current;
    if (!videoId || !host) return;

    // The API replaces the mount node, so create a disposable child.
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    host.appendChild(mount);

    let disposed = false;
    let instance: YTPlayer | null = null;

    void loadIframeApi().then((YT) => {
      if (disposed) return;
      instance = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            if (disposed) return;
            setPlayer(instance);
            if (import.meta.env.DEV) {
              (window as unknown as Record<string, unknown>).__ytPlayer = instance;
            }
          },
          onStateChange: (event) => {
            if (disposed) return;
            onStateChangeRef.current?.(event.data);
          },
        },
      });
    });

    return () => {
      disposed = true;
      setPlayer(null);
      try {
        instance?.destroy();
      } catch {
        // already gone
      }
      host.replaceChildren();
    };
  }, [videoId]);

  return { containerRef, player };
}
