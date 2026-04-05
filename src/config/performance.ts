/**
 * Performance optimization configuration
 * Centralized settings for animations, caching, and resource management
 */

export const PERFORMANCE_CONFIG = {
  // Animation settings
  animation: {
    // Spring animation configs
    spring: {
      default: { tension: 300, friction: 28 },
      fast: { tension: 320, friction: 24 },
      slow: { tension: 260, friction: 32 },
      smooth: { tension: 200, friction: 30 },
    },
    // Transition durations (aligned with UI/UX Pro Max guidelines)
    transition: {
      micro: 150,    // Tap feedback, small state changes
      fast: 200,     // Hover states, icon transitions
      normal: 300,   // Standard UI transitions (modals, panels)
      slow: 400,     // Complex transitions (page changes)
      verySlow: 500, // Auto-hide timers, background fades
    },
    // Easing curves
    easing: {
      easeOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',   // Entering animations
      easeIn: 'cubic-bezier(0.32, 0.72, 0, 1)',    // Exiting animations
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy interactions
      smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',  // Color/background transitions
    },
  },

  // Cache settings
  cache: {
    // Color extraction cache
    colorExtraction: {
      maxSize: 50,
      ttl: 10 * 60 * 1000, // 10 minutes
    },
    // Lyrics cache
    lyrics: {
      maxSize: 100,
      ttl: 30 * 60 * 1000, // 30 minutes
    },
    // Image cache
    image: {
      maxSize: 200,
      ttl: 60 * 60 * 1000, // 1 hour
    },
  },

  // Debounce delays
  debounce: {
    search: 300,
    resize: 150,
    scroll: 100,
    input: 200,
  },

  // Throttle delays
  throttle: {
    scroll: 16, // ~60fps
    resize: 16,
    mousemove: 16,
  },

  // Virtual list settings
  virtualList: {
    overscan: 3, // Number of items to render outside viewport
    itemHeight: 64, // Default item height in pixels
  },

  // Background tasks
  background: {
    // Maximum concurrent background tasks
    maxConcurrent: 3,
    // Delay before starting background tasks (ms)
    startDelay: 1000,
    // Maximum cache size for background buffering (MB)
    maxCacheSize: 100,
  },

  // Memory management
  memory: {
    // Maximum number of audio elements to keep in memory
    maxAudioElements: 2, // Reduced from 3 for better memory usage
    // Maximum number of canvas contexts
    maxCanvasContexts: 4, // Reduced from 6
    // Cleanup interval (ms)
    cleanupInterval: 2 * 60 * 1000, // 2 minutes (more frequent cleanup)
    // Enable aggressive garbage collection hints
    enableGCHints: true,
    // Maximum image cache size
    maxImageCache: 8, // Reduced from 10
    // Maximum image memory (MB)
    maxImageMemory: 40, // Reduced from 50
  },
  
  // Canvas optimization
  canvas: {
    // Maximum pixel ratio (prevent excessive memory on 4K displays)
    maxPixelRatio: 2,
    // Use adaptive pixel ratio based on device memory
    adaptivePixelRatio: true,
    // Maximum canvas size (pixels)
    maxCanvasSize: 3840, // Reduced from 4096
    // Enable canvas context pooling
    enableContextPooling: true,
  },
  
  // Audio-specific optimizations
  audio: {
    // Preload strategy: 'none', 'metadata', 'auto'
    preload: 'metadata',
    // Buffer size for audio streaming (in seconds)
    bufferSize: 10,
    // Enable audio worklet for better performance
    useAudioWorklet: true,
    // Maximum concurrent audio decoding operations
    maxConcurrentDecoding: 2,
  },
  
  // Rendering optimizations
  rendering: {
    // Use requestIdleCallback for non-critical updates
    useIdleCallback: true,
    // Target frame rate for animations
    targetFPS: 60,
    // Enable hardware acceleration hints
    enableHardwareAcceleration: true,
    // Reduce motion for low-end devices
    respectReducedMotion: true,
    // Batch DOM updates
    batchDOMUpdates: true,
    // Use CSS containment for isolated components
    useCSSContainment: true,
  },
  
  // WebView specific optimizations
  webview: {
    // Reduce repaints by limiting layer updates
    limitLayerUpdates: true,
    // Use passive event listeners
    usePassiveListeners: true,
    // Debounce scroll events
    debounceScroll: true,
    // Optimize image loading
    lazyLoadImages: true,
    // Reduce backdrop filter usage
    limitBackdropFilters: true,
    // Use CSS transforms instead of position changes
    preferTransforms: true,
  },

  // Event listener optimization
  events: {
    // Use passive listeners for scroll/touch events
    usePassive: true,
    // Use capture phase for click outside detection
    useCapture: true,
  },
} as const;

/**
 * Get animation config by name
 */
export const getAnimationConfig = (name: keyof typeof PERFORMANCE_CONFIG.animation.spring) => {
  return PERFORMANCE_CONFIG.animation.spring[name];
};

/**
 * Get cache config by type
 */
export const getCacheConfig = (type: keyof typeof PERFORMANCE_CONFIG.cache) => {
  return PERFORMANCE_CONFIG.cache[type];
};

/**
 * Check if device is low-end (for performance degradation)
 */
export const isLowEndDevice = (): boolean => {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }

  // Check for low memory
  if ('deviceMemory' in navigator && (navigator as any).deviceMemory < 4) {
    return true;
  }

  // Check for slow connection
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
      return true;
    }
  }

  return false;
};

/**
 * Get optimized pixel ratio based on device capabilities
 */
export const getOptimalPixelRatio = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const deviceMemory = (navigator as any).deviceMemory || 4;
  
  // Low memory devices: use 1x
  if (deviceMemory < 4) {
    return 1;
  }
  
  // Medium memory devices: cap at 1.5x
  if (deviceMemory < 8) {
    return Math.min(devicePixelRatio, 1.5);
  }
  
  // High memory devices: cap at 2x
  return Math.min(devicePixelRatio, 2);
};

/**
 * Get optimal background layer count based on device
 */
export const getOptimalLayerCount = (isMobile: boolean): number => {
  const deviceMemory = (navigator as any).deviceMemory || 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    return 1; // Minimal for accessibility
  }
  
  if (isMobile) {
    return deviceMemory < 2 ? 1 : deviceMemory < 4 ? 2 : 3;
  }
  
  return deviceMemory < 2 ? 1 : deviceMemory < 4 ? 2 : deviceMemory < 8 ? 3 : 4;
};

/**
 * Check if visualizer should be enabled by default
 */
export const shouldEnableVisualizer = (): boolean => {
  const deviceMemory = (navigator as any).deviceMemory || 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return deviceMemory >= 4 && !prefersReducedMotion;
};

/**
 * Get optimal canvas pixel ratio
 */
export const getOptimalCanvasPixelRatio = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const deviceMemory = (navigator as any).deviceMemory || 4;
  
  // Very low memory: use 1x
  if (deviceMemory < 2) {
    return 1;
  }
  
  // Low memory: cap at 1x
  if (deviceMemory < 4) {
    return Math.min(devicePixelRatio, 1);
  }
  
  // Medium memory: cap at 1.5x
  if (deviceMemory < 8) {
    return Math.min(devicePixelRatio, 1.5);
  }
  
  // High memory: cap at 2x
  return Math.min(devicePixelRatio, PERFORMANCE_CONFIG.canvas.maxPixelRatio);
};
