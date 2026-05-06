import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const config: UserConfig & {
  test: {
    environment: string;
    setupFiles: string[];
  };
} = {
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
};

export default defineConfig(config);
