import type { PhotoCropDraft } from "@/lib/domain/family-types";
export async function cropProfileImage(draft: PhotoCropDraft) {
  const image = await loadImage(draft.imageUrl);
  const canvas = document.createElement("canvas");
  const outputSize = 256;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) return draft.imageUrl;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);

  const area = draft.croppedAreaPixels ?? {
    x: 0,
    y: 0,
    width: Math.min(image.width, image.height),
    height: Math.min(image.width, image.height),
  };

  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  context.restore();

  return canvas.toDataURL("image/jpeg", 0.86);
}

export async function resizeImageFile(file: File, maxSize: number, quality: number) {
  const image = await loadImage(await fileToDataUrl(file));
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return fileToDataUrl(file);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
