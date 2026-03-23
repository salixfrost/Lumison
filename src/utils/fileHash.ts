/**
 * Compute SHA-256 hash of a file/blob as hex string.
 * Falls back to a simple string hash if Web Crypto not available.
 */
export const computeSha256 = async (data: ArrayBuffer): Promise<string> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback: simple hash based on string representation (not secure)
    const view = new Uint8Array(data);
    let hash = 0;
    for (let i = 0; i < Math.min(view.length, 1024); i++) {
      hash = ((hash << 5) - hash) + view[i];
      hash |= 0;
    }
    return 'fallback_' + (hash >>> 0).toString(16).padStart(8, '0');
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Compute SHA-256 of a Blob (convenience wrapper).
 */
export const computeBlobHash = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  return computeSha256(buffer);
};

/**
 * Compute a stable cache key for a file path/URL.
 * For local blob URLs, we can't rely on the URL itself (changes each session).
 * This function attempts to extract a stable identifier:
 * - For remote URLs, returns the URL.
 * - For blob URLs, returns a promise that hashes the blob content.
 * - For data URLs, returns the data URL (can be large).
 */
export const getStableImageKey = async (src: string): Promise<string> => {
  if (src.startsWith('blob:')) {
    // Fetch the blob and hash it
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const hash = await computeBlobHash(blob);
      return `blob:${hash}`;
    } catch {
      // Fallback to original src
      return src;
    }
  }
  // For http/https/data URLs, use as-is
  return src;
};