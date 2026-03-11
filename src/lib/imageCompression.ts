/**
 * Client-side image compression utility.
 * Compresses images before upload to reduce file sizes and improve loading times.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    maxSizeMB = 1,
  } = options;

  // Skip if already small enough
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed, preserving aspect ratio
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

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const ext = file.name.split(".").pop()?.toLowerCase();
          const name = file.name.replace(/\.[^.]+$/, "") + (ext === "png" ? ".png" : ".jpg");
          resolve(new File([blob], name, { type: blob.type }));
        },
        file.type === "image/png" ? "image/png" : "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fall back to original on error
    };

    img.src = url;
  });
}

/**
 * Extract city and country from a location string.
 * Returns "City, Country" or original string if parsing fails.
 */
export function formatLocationCityCountry(location: string | null): string {
  if (!location) return "";
  const parts = location.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    // Take first part as city, last part as country
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }
  return location;
}
