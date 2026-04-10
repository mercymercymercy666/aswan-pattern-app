/**
 * Reads an image as a grayscale float grid (0 = black, 1 = white).
 * Used for moiré layers where pixel darkness drives line stroke width.
 */
export function grayscaleImageFile(file, gridSize = 64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = gridSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, gridSize, gridSize);
      const px = ctx.getImageData(0, 0, gridSize, gridSize).data;
      const N = gridSize;
      const grid = [];
      for (let r = 0; r < N; r++) {
        const row = [];
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          row.push((px[i*4]*0.299 + px[i*4+1]*0.587 + px[i*4+2]*0.114) / 255);
        }
        grid.push(row);
      }
      URL.revokeObjectURL(url);
      resolve(grid);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/**
 * Apply a simple luminance threshold to a raw grayscale grid (0=black, 1=white).
 * Returns binary grid: 1 = dark (filled stitch), 0 = light (empty).
 * threshold 0–1: lower = fewer stitches (only darkest pixels), higher = more.
 */
export function applyThreshold(rawGray, threshold = 0.5) {
  return rawGray.map(row => row.map(v => v < threshold ? 1 : 0));
}

/**
 * Load an image as a raw grayscale float grid (0=black, 1=white) plus
 * an initial binary grid at the given threshold.
 * Store rawGray alongside the grid so threshold can be adjusted live.
 */
export function ditherImageFile(file, gridSize = 48, threshold = 0.5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = gridSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, gridSize, gridSize);
      const px = ctx.getImageData(0, 0, gridSize, gridSize).data;
      const N  = gridSize;

      const rawGray = [];
      for (let r = 0; r < N; r++) {
        const row = [];
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          row.push((px[i*4]*0.299 + px[i*4+1]*0.587 + px[i*4+2]*0.114) / 255);
        }
        rawGray.push(row);
      }

      URL.revokeObjectURL(url);
      resolve({ rawGray, grid: applyThreshold(rawGray, threshold) });
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
