export abstract class BaseBackgroundRender {
  protected targetFps: number;
  private frameInterval: number;
  protected lastRenderTime = 0;
  protected isPaused = false;
  protected isVisible = true;
  private visibilityHandler: () => void;

  constructor(targetFps: number = 60) {
    this.targetFps = targetFps;
    this.frameInterval = 1000 / targetFps;
    
    // Visibility change handler
    this.visibilityHandler = () => {
      this.isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  setTargetFps(fps: number) {
    this.targetFps = fps;
    this.frameInterval = 1000 / fps;
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  protected shouldRender(now: number) {
    // Skip rendering when tab is hidden to save CPU/GPU
    if (!this.isVisible) {
      return false;
    }
    
    if (this.lastRenderTime === 0) {
      this.lastRenderTime = now;
      return true;
    }

    const elapsed = now - this.lastRenderTime;
    if (elapsed < this.frameInterval) {
      return false;
    }

    this.lastRenderTime = now - (elapsed % this.frameInterval);
    return true;
  }

  protected resetClock(startTime: number) {
    this.lastRenderTime = startTime;
  }
  
  protected cleanup() {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  abstract start(colors?: string[]): void;
  abstract stop(): void;
}
