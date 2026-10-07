const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Reads an uploaded image, scales it down and re-encodes it as a data URL so
 * it can be kept in localStorage and used offline.
 * Rejects with a readable message if the file cannot be used.
 */
export function fileToDataUrl(file, { maxSize, type = 'image/png', quality = 0.85 }) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG or JPEG).'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error('That image is too large. Please choose one under 20 MB.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL(type, quality));
      } catch {
        reject(new Error('That image could not be processed. Please try a PNG or JPEG file.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. Please try a PNG or JPEG file.'));
    };
    image.src = url;
  });
}
