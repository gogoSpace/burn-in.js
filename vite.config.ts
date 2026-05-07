import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      tsconfigPath: "tsconfig.build.json"
    })
  ],
  build: {
    target: "es2020",
    lib: {
      entry: {
        index: "src/index.ts",
        vue: "src/vue.ts"
      },
      formats: ["es"]
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        entryFileNames: "[name].js"
      }
    }
  }
});
