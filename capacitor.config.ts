import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tailtots.family",
  appName: "TailTots",
  webDir: "dist/client",
  server: {
    url: "https://pawpal-quest-kids.navin-nala-0658.chatgpt.site",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
