import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5177
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
