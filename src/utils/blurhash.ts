import { encode, decode } from "blurhash";

export const generateBlurhash = async (
  imageSrc: string,
  componentX: number = 4,
  componentY: number = 3
): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const sizeX = Math.min(32, Math.max(componentX, Math.round(img.width / 8)));
        const sizeY = Math.min(32, Math.max(componentY, Math.round(img.height / 8)));
        
        canvas.width = sizeX;
        canvas.height = sizeY;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, sizeX, sizeY);
        const imageData = ctx.getImageData(0, 0, sizeX, sizeY);
        
        const blurhash = encode(imageData.data, sizeX, sizeY, componentX, componentY);
        resolve(blurhash);
      } catch {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
};

export const decodeBlurhashToDataURL = (
  blurhash: string,
  width: number = 32,
  height: number = 32
): string | null => {
  try {
    const pixels = decode(blurhash, width, height);
    
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas.toDataURL();
  } catch {
    return null;
  }
};

export const decodeBlurhashToPixels = (
  blurhash: string,
  width: number = 32,
  height: number = 32
): Uint8ClampedArray | null => {
  try {
    return decode(blurhash, width, height);
  } catch {
    return null;
  }
};

export const isValidBlurhash = (hash: string | null | undefined): boolean => {
  if (!hash || typeof hash !== "string") return false;
  return hash.length >= 6 && /^[A-Za-z0-9+/]+={0,2}$/.test(hash);
};
