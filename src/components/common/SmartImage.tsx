import React, {
  CSSProperties,
  ImgHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { imageResourceCache } from "../../services/cache";
import { getStableImageKey } from "../../utils/fileHash";
import { decodeBlurhashToDataURL, isValidBlurhash } from "../../utils/blurhash";

const makeCacheKey = (src: string, width: number, height: number) => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const ratio = (width / height).toFixed(3);
  return `${src}|${ratio}|${width}x${height}@${Math.round(dpr * 100)}`;
};

interface SmartImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className" | "style"> {
  src: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  placeholder?: React.ReactNode;
  blurhash?: string | null;
  targetWidth?: number;
  targetHeight?: number;
}

const DEFAULT_PLACEHOLDER = (
  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10 animate-pulse text-white/30 text-[10px] font-semibold tracking-widest">
    <span>♪</span>
  </div>
);

const SmartImage: React.FC<SmartImageProps> = ({
  src,
  containerClassName,
  containerStyle,
  imgClassName,
  imgStyle,
  placeholder,
  blurhash,
  alt = "",
  targetWidth,
  targetHeight,
  loading = "lazy",
  ...imgProps
}) => {
  const [isVisible, setIsVisible] = useState(loading === "eager");
  const [isLoaded, setIsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [stableKey, setStableKey] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const currentUrlIsBlobRef = useRef(false);
  const lastComputedSrcRef = useRef<string | null>(null);

  const revokeCurrentObjectUrl = useCallback(() => {
    if (currentUrlRef.current && currentUrlIsBlobRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
  }, []);

  const resetDisplay = useCallback(() => {
    revokeCurrentObjectUrl();
    currentUrlRef.current = null;
    currentUrlIsBlobRef.current = false;
    setDisplaySrc(null);
  }, [revokeCurrentObjectUrl]);

  const setFinalUrl = useCallback(
    (url: string, isBlob: boolean) => {
      revokeCurrentObjectUrl();
      currentUrlRef.current = url;
      currentUrlIsBlobRef.current = isBlob;
      setDisplaySrc(url);
    },
    [revokeCurrentObjectUrl],
  );

  useEffect(() => {
    if (loading === "eager") {
      setIsVisible(true);
      return undefined;
    }

    const element = containerRef.current;
    if (!element) {
      setIsVisible(false);
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry?.isIntersecting ?? false);
      },
      {
        rootMargin: "200px",
        threshold: 0.01,
      },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [loading]);

  useLayoutEffect(() => {
    if (typeof targetWidth === "number" && typeof targetHeight === "number") {
      setMeasuredSize({
        width: targetWidth,
        height: targetHeight,
      });
      return;
    }

    const element = containerRef.current;
    if (!element) {
      setMeasuredSize(null);
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setMeasuredSize((prev) => {
        const roundedWidth = Math.round(rect.width);
        const roundedHeight = Math.round(rect.height);
        if (
          prev &&
          Math.round(prev.width) === roundedWidth &&
          Math.round(prev.height) === roundedHeight
        ) {
          return prev;
        }
        return {
          width: rect.width,
          height: rect.height,
        };
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [targetHeight, targetWidth]);

  // Compute stable cache key for image src (handles blob URLs by hashing content)
  useEffect(() => {
    if (!src) {
      lastComputedSrcRef.current = null;
      setStableKey(null);
      return;
    }

    // If src changed, reset stableKey and lastComputedSrc
    if (lastComputedSrcRef.current !== src) {
      lastComputedSrcRef.current = null;
      setStableKey(null);
    }

    // If already computed for this src, keep current stableKey
    if (stableKey !== null && lastComputedSrcRef.current === src) {
      return;
    }

    if (!isVisible) {
      return; // Wait until visible to compute
    }

    let canceled = false;
    lastComputedSrcRef.current = src;

    getStableImageKey(src)
      .then((key) => {
        if (!canceled && lastComputedSrcRef.current === src) {
          setStableKey(key);
        }
      })
      .catch(() => {
        if (!canceled && lastComputedSrcRef.current === src) {
          setStableKey(src); // Fallback to original src
        }
      });

    return () => {
      canceled = true;
    };
  }, [src, isVisible, stableKey]);

  const normalizedSize = useMemo(() => {
    if (!measuredSize) return null;
    const width = Math.max(1, Math.round(measuredSize.width));
    const height = Math.max(1, Math.round(measuredSize.height));
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }, [measuredSize]);

  const effectiveKey = useMemo(() => {
    if (!normalizedSize || !stableKey) return null;
    return makeCacheKey(stableKey, normalizedSize.width, normalizedSize.height);
  }, [normalizedSize, stableKey]);

  useEffect(() => {
    if (!normalizedSize || !src || !effectiveKey) {
      resetDisplay();
      return;
    }
    if (!isVisible) {
      return;
    }

    let canceled = false;
    const cachedBlob = imageResourceCache.get(effectiveKey);
    if (cachedBlob) {
      const cachedUrl = URL.createObjectURL(cachedBlob);
      setFinalUrl(cachedUrl, true);
      return () => {
        canceled = true;
        URL.revokeObjectURL(cachedUrl);
      };
    }

    const imageElement = new Image();

    const handleFallback = () => {
      if (canceled) return;
      resetDisplay();
    };

    const loadImage = () => {
      if (canceled) return;
      const ratio = Math.min(
        normalizedSize.width / imageElement.naturalWidth,
        normalizedSize.height / imageElement.naturalHeight,
        1,
      );
      const targetWidth = Math.max(1, Math.round(imageElement.naturalWidth * ratio));
      const targetHeight = Math.max(1, Math.round(imageElement.naturalHeight * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        handleFallback();
        return;
      }

      ctx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);

      try {
        canvas.toBlob(
          (blob) => {
            if (!blob || canceled) {
              handleFallback();
              return;
            }

            try {
              imageResourceCache.set(effectiveKey, blob);
            } catch {
              // Silently ignore cache failures.
            }

            const optimizedUrl = URL.createObjectURL(blob);
            if (canceled) {
              URL.revokeObjectURL(optimizedUrl);
              return;
            }
            setFinalUrl(optimizedUrl, true);
          },
          "image/jpeg",
          0.78,
        );
      } catch {
        handleFallback();
      }
    };

    imageElement.crossOrigin = src.startsWith("blob:") || src.startsWith("data:") ? "" : "anonymous";
    imageElement.onload = () => {
      if (canceled) return;
      if (!imageElement.naturalWidth || !imageElement.naturalHeight) {
        handleFallback();
        return;
      }
      loadImage();
    };
    imageElement.onerror = () => {
      if (canceled) return;
      handleFallback();
    };
    imageElement.src = src;

    return () => {
      canceled = true;
      imageElement.onload = null;
      imageElement.onerror = null;
      imageElement.src = "";
    };
  }, [effectiveKey, normalizedSize, resetDisplay, setFinalUrl, src, isVisible]);

  const blurhashDataURL = useMemo(() => {
    if (!isValidBlurhash(blurhash)) return null;
    return decodeBlurhashToDataURL(blurhash, 32, 32);
  }, [blurhash]);

  const showPlaceholder = !displaySrc;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${containerClassName ?? ""}`}
      style={containerStyle}
    >
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          className={imgClassName}
          style={{
            ...imgStyle,
            transition: "opacity 0.3s ease-out",
            opacity: 1,
          }}
          loading={loading as "lazy" | "eager"}
          onLoad={() => setIsLoaded(true)}
          {...imgProps}
        />
      ) : blurhashDataURL ? (
        <img
          src={blurhashDataURL}
          alt=""
          className={imgClassName}
          style={{
            ...imgStyle,
            filter: "blur(20px)",
            transform: "scale(1.2)",
          }}
          aria-hidden="true"
        />
      ) : (
        placeholder ?? DEFAULT_PLACEHOLDER
      )}
    </div>
  );
};

export default SmartImage;
