/**
 * Client-side image compression + helpers for serving smaller image variants
 * via Supabase Storage's render endpoint.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** Re-encode any file larger than this (in MB). */
  maxSizeMB?: number;
}

// Detect WebP encoding support once.
let _webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (_webpSupport !== null) return _webpSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.72,
    maxSizeMB = 0.4, // re-encode anything bigger than ~400 KB
  } = options;

  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxSizeMB * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const useWebp = supportsWebp() && file.type !== "image/png";
      const outType = useWebp ? "image/webp" : file.type === "image/png" ? "image/png" : "image/jpeg";
      const ext = useWebp ? "webp" : file.type === "image/png" ? "png" : "jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Only swap if it actually got smaller.
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
          resolve(new File([blob], name, { type: outType }));
        },
        outType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Rewrite a Supabase public storage URL to use the on-the-fly image
 * transformation endpoint, returning a smaller, faster-loading variant.
 *
 * Falls back to the original URL for non-Supabase or unrecognized inputs.
 */
export function getStorageThumb(
  url: string | null | undefined,
  opts: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" } = {}
): string {
  if (!url) return "";
  // Only transform Supabase public-object URLs.
  // Pattern: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const base = url.substring(0, idx);
  const rest = url.substring(idx + marker.length);
  const { width, height, quality = 70, resize = "cover" } = opts;

  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  params.set("quality", String(quality));
  params.set("resize", resize);

  return `${base}/storage/v1/render/image/public/${rest}?${params.toString()}`;
}

/**
 * Extract city and country from a location string.
 */
export function formatLocationCityCountry(location: string | null): string {
  if (!location) return "";
  const parts = location.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }
  return location;
}
