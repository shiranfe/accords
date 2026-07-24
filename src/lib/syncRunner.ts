export type SyncRunResult = {
  ok: boolean;
  summary?: string;
  error?: string;
};

/**
 * Ask the dev server (vite middleware /api/sync) to run the audio-alignment
 * pipeline for a song. Resolves when the pipeline finishes (~1 minute).
 */
export async function runSyncOnServer(params: {
  songId: string;
  youtubeUrl: string;
  source: string;
  meter?: number;
}): Promise<SyncRunResult> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await res.json()) as SyncRunResult;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
