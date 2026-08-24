import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "dist/mobile/index.html",
  "dist/mobile/manifest.webmanifest",
  "dist/mobile/sw.js",
  "dist/mobile/favicon.svg",
  "dist/mobile/tailtots-logo.png",
  "android/settings.gradle",
  "android/build.gradle",
  "android/gradlew.bat",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/assets/capacitor.config.json",
  "android/app/src/main/assets/public/manifest.webmanifest",
  "android/app/src/main/assets/public/sw.js",
];

for (const file of requiredFiles) {
  await access(file);
}

const manifest = JSON.parse(await readFile("dist/mobile/manifest.webmanifest", "utf8"));
if (manifest.name !== "TailTots" || manifest.display !== "standalone") {
  throw new Error("PWA manifest is not configured for TailTots standalone mode.");
}

const capacitorConfig = JSON.parse(await readFile("android/app/src/main/assets/capacitor.config.json", "utf8"));
if (capacitorConfig.appId !== "com.tailtots.family") {
  throw new Error("Android Capacitor appId is not com.tailtots.family.");
}

const androidManifest = await readFile("android/app/src/main/AndroidManifest.xml", "utf8");
if (!androidManifest.includes('android:allowBackup="false"')) {
  throw new Error("Android backup must be disabled for family testing builds.");
}

console.log("Web/PWA, Android, and Amazon Fire packaging files verified.");
