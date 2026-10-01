import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./src",
    include: ["**/*.spec.ts"],
    environment: "node",
  },
  // SWC emite os metadados de decorators que o Nest usa na injeção de dependências.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
