import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const page = (path: string) => resolve(__dirname, path);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      // The app, the widget iframe (embed.html) and the sample intranet that hosts the widget.
      input: {
        main: page("index.html"),
        embed: page("embed.html"),
        hub: page("hub/index.html"),
        hubBenefits: page("hub/benefits.html"),
        hubIt: page("hub/it.html"),
      },
    },
  },
});
