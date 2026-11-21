import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        storefront: resolve(process.cwd(), "index.html"),
        admin: resolve(process.cwd(), "admin.html"),
      },
    },
  },
});