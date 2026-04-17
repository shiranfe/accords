import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const reactRefreshPreamble = `
<script type="module">
  import RefreshRuntime from "/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "react-refresh-preamble",
      apply: "serve",
      transformIndexHtml(html) {
        return html.replace("<head>", `<head>${reactRefreshPreamble}`);
      },
    },
  ],
});
