import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  // Release builds may inject these via process env (CI / local .env absent).
  // Values are baked into the JS bundle at build time — never commit real keys.
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return {
    root: "mobile",
    publicDir: path.resolve(rootDir, "public"),
    plugins: [react()],
    define: {
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
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
