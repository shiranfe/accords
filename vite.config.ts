import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import type { Connect, Plugin } from "vite";
import react from "@vitejs/plugin-react";

const reactRefreshPreamble = `
<script type="module">
  import RefreshRuntime from "/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`;

type SyncRequest = {
  songId?: string;
  youtubeUrl?: string;
  source?: string;
  meter?: number;
  /** Music start override in seconds; omitted = auto-detect leading silence */
  startSec?: number;
  /** Tempo hint in BPM; omitted = auto-estimate */
  bpmHint?: number;
};

/**
 * Dev-only endpoint: POST /api/sync runs pipeline/align.py for a song and
 * writes public/sync/<songId>.json. Lets the browser trigger audio
 * alignment without touching a terminal. One job at a time.
 */
function syncPipelinePlugin(): Plugin {
  let running = false;

  const handler: Connect.NextHandleFunction = (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ ok: false, error: "POST only" }));
      return;
    }
    if (running) {
      res.statusCode = 409;
      res.end(JSON.stringify({ ok: false, error: "סנכרון אחר כבר רץ — נסה שוב עוד רגע" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let data: SyncRequest;
      try {
        data = JSON.parse(body) as SyncRequest;
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "invalid JSON" }));
        return;
      }

      const { songId, youtubeUrl, source, meter, startSec, bpmHint } = data;
      if (!songId || !/^[\w-]+$/.test(songId)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "invalid songId" }));
        return;
      }
      if (!source || source.trim().length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "empty source" }));
        return;
      }
      if (!youtubeUrl || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtubeUrl)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "חסר קישור יוטיוב תקין לשיר" }));
        return;
      }

      const root = __dirname;
      const workDir = path.join(root, "pipeline", "cache");
      mkdirSync(workDir, { recursive: true });
      const neginaFile = path.join(workDir, `src-${songId}.txt`);
      writeFileSync(neginaFile, source, "utf-8");

      const python = path.join(root, "pipeline", ".venv", "Scripts", "python.exe");
      const outFile = path.join(root, "public", "sync", `${songId}.json`);
      const args = [
        path.join(root, "pipeline", "align.py"),
        "--url",
        youtubeUrl,
        "--negina",
        neginaFile,
        "--out",
        outFile,
        "--meter",
        String(meter && Number.isFinite(meter) ? meter : 4),
      ];
      if (typeof startSec === "number" && Number.isFinite(startSec) && startSec >= 0) {
        args.push("--start", String(startSec));
      }
      if (typeof bpmHint === "number" && Number.isFinite(bpmHint) && bpmHint >= 30 && bpmHint <= 300) {
        args.push("--bpm", String(bpmHint));
      }

      running = true;
      const child = spawn(python, args, { cwd: path.join(root, "pipeline") });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += String(d)));
      child.stderr.on("data", (d) => (stderr += String(d)));

      const killTimer = setTimeout(() => child.kill(), 8 * 60 * 1000);

      child.on("close", (code) => {
        clearTimeout(killTimer);
        running = false;
        res.setHeader("Content-Type", "application/json");
        if (code === 0) {
          const summary = stdout.trim().split("\n").at(-1) ?? "done";
          res.end(JSON.stringify({ ok: true, summary }));
        } else {
          const errorTail = (stderr || stdout).trim().split("\n").slice(-4).join("\n");
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: errorTail || `exit code ${code}` }));
        }
      });
      child.on("error", (err) => {
        clearTimeout(killTimer);
        running = false;
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      });
    });
  };

  return {
    name: "sync-pipeline-endpoint",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/sync", handler);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    syncPipelinePlugin(),
    {
      name: "react-refresh-preamble",
      apply: "serve",
      transformIndexHtml(html) {
        return html.replace("<head>", `<head>${reactRefreshPreamble}`);
      },
    },
  ],
});
