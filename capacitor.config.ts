import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tailtots.family",
  appName: "TailTots",
  webDir: "dist/client",
  server: {
    url: "https://tailtots.com",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
