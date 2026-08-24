import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");

  return {
    root: "mobile",
    publicDir: path.resolve(rootDir, "public"),
    plugins: [react()],
    define: {
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    },
    resolve: {
      alias: {
        "@": rootDir,
        "next/image": path.resolve(rootDir, "mobile/src/next-image-shim.tsx"),
      },
    },
    build: {
      outDir: "../dist/mobile",
      emptyOutDir: true,
    },
  };
});
