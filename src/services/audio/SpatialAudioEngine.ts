/**
 * Spatial Audio Engine - Dolby-like 3D Audio Effect System
 * 
 * ⚠️ DISCLAIMER: This is NOT real Dolby Atmos. This is a simulated
 * spatial enhancement system for immersive headphone listening.
 * 
 * Psychoacoustic Principles Used:
 * 1. HRTF (Head-Related Transfer Function) - Simulates 3D positioning
 * 2. Haas Effect - Delays create spatial width (precedence effect)
 * 3. Stereo Widening - Mid/Side processing for enhanced soundstage
 * 4. Harmonic Excitation - Adds perceived clarity and presence
 * 5. Convolution Reverb - Simulates acoustic spaces
 * 6. Dynamic Range Compression - Maintains consistent loudness
 */

export interface SpatialAudioConfig {
  enabled: boolean;
  preset: 'music' | 'cinema' | 'vocal' | 'custom';
  
  // Equalizer (5-band)
  eq: {
    sub: number;      // 60Hz  - Deep bass
    bass: number;     // 200Hz - Bass
    mid: number;      // 1kHz  - Midrange
    highMid: number;  // 4kHz  - Presence
    treble: number;   // 12kHz - Air/Sparkle
  };
  
  // Spatial parameters
  spatial: {
    width: number;        // 0-1: Stereo width
    depth: number;        // 0-1: Reverb depth
    height: number;       // 0-1: Vertical positioning
    roomSize: number;     // 0-1: Virtual room size
    distance: number;     // 0-1: Listener distance
  };
  
  // Enhancement
  enhancement: {
    exciter: number;      // 0-1: Harmonic excitation
    clarity: number;      // 0-1: High-frequency boost
    warmth: number;       // 0-1: Low-frequency enhancement
  };
  
  // Dynamics
  dynamics: {
    normalize: boolean;   // Auto-gain normalization
    limiterThreshold: number; // -20 to 0 dB
  };
}

export const PRESETS: Record<string, Partial<SpatialAudioConfig>> = {
  music: {
    eq: { sub: 2, bass: 1, mid: 0, highMid: 1, treble: 2 },
    spatial: { width: 0.7, depth: 0.3, height: 0.5, roomSize: 0.4, distance: 0.5 },
    enhancement: { exciter: 0.3, clarity: 0.4, warmth: 0.3 },
  },
  cinema: {
    eq: { sub: 4, bass: 2, mid: 0, highMid: 2, treble: 1 },
    spatial: { width: 0.9, depth: 0.6, height: 0.7, roomSize: 0.8, distance: 0.6 },
    enhancement: { exciter: 0.5, clarity: 0.6, warmth: 0.4 },
  },
  vocal: {
    eq: { sub: -2, bass: 0, mid: 2, highMid: 3, treble: 1 },
    spatial: { width: 0.4, depth: 0.2, height: 0.3, roomSize: 0.3, distance: 0.4 },
    enhancement: { exciter: 0.2, clarity: 0.7, warmth: 0.2 },
  },
};

export class SpatialAudioEngine {
  private static instanceCount = 0;
  private instanceId: number;
  
  private ctx: AudioContext;
  private source: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  
  // Processing nodes
  private inputGain: GainNode;
  private outputGain: GainNode;
  
  // 5-band EQ
  private eqNodes: {
    sub: BiquadFilterNode;
    bass: BiquadFilterNode;
    mid: BiquadFilterNode;
    highMid: BiquadFilterNode;
    treble: BiquadFilterNode;
  };
  
  // Spatial processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private leftDelay: DelayNode;
  private rightDelay: DelayNode;
  private haasGain: GainNode;
  
  // 3D positioning
  private panner: PannerNode;
  private listenerPosition: { x: number; y: number; z: number };
  
  // Reverb
  private convolver: ConvolverNode;
  private reverbGain: GainNode;
  private dryGain: GainNode;
  
  // Harmonic exciter
  private exciterGain: GainNode;
  private exciterWaveShaper: WaveShaperNode;
  
  // Dynamics
  private compressor: DynamicsCompressorNode;
  private limiter: DynamicsCompressorNode;
  
  // Analyzer for visual feedback
  private analyzer: AnalyserNode;
  
  private config: SpatialAudioConfig;
  private isConnected: boolean = false;
  
  constructor(audioContext?: AudioContext) {
    SpatialAudioEngine.instanceCount++;
    this.instanceId = SpatialAudioEngine.instanceCount;
    console.log(`[SpatialAudioEngine #${this.instanceId}] Creating new instance (total: ${SpatialAudioEngine.instanceCount})`);
    
    this.ctx = audioContext || new AudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Will be resumed on user interaction
      });
    }
    
    // Initialize default config
    this.config = {
      enabled: false,
      preset: 'music',
      eq: { sub: 0, bass: 0, mid: 0, highMid: 0, treble: 0 },
      spatial: { width: 0.5, depth: 0.3, height: 0.5, roomSize: 0.5, distance: 0.5 },
      enhancement: { exciter: 0.3, clarity: 0.3, warmth: 0.3 },
      dynamics: { normalize: true, limiterThreshold: -1 },
    };
    
    this.listenerPosition = { x: 0, y: 0, z: 0 };
    
    // Create all nodes
    this.inputGain = this.ctx.createGain();
    this.outputGain = this.ctx.createGain();
    
    // Create 5-band EQ
    this.eqNodes = {
      sub: this.createEQBand('lowshelf', 60),
      bass: this.createEQBand('peaking', 200),
      mid: this.createEQBand('peaking', 1000),
      highMid: this.createEQBand('peaking', 4000),
      treble: this.createEQBand('highshelf', 12000),
    };
    
    // Spatial processing (Haas effect)
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);
    this.leftDelay = this.ctx.createDelay(0.1);
    this.rightDelay = this.ctx.createDelay(0.1);
    this.haasGain = this.ctx.createGain();
    
    // 3D Panner (HRTF-based)
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF'; // Head-Related Transfer Function
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 10000;
    this.panner.rolloffFactor = 1;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 0;
    this.panner.coneOuterGain = 0;
    
    // Reverb
    this.convolver = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    
    // Harmonic exciter
    this.exciterGain = this.ctx.createGain();
    this.exciterWaveShaper = this.ctx.createWaveShaper();
    this.exciterWaveShaper.curve = this.createExciterCurve() as any;
    this.exciterWaveShaper.oversample = '4x';
    
    // Dynamics
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.01;
    
    // Analyzer
    this.analyzer = this.ctx.createAnalyser();
    this.analyzer.fftSize = 2048;
    this.analyzer.smoothingTimeConstant = 0.8;
    
    // Set initial gain values (disabled state)
    this.inputGain.gain.value = 1;
    this.outputGain.gain.value = 1;
    this.dryGain.gain.value = 1; // Full dry signal when disabled
    this.haasGain.gain.value = 0; // No spatial widening when disabled
    this.reverbGain.gain.value = 0; // No reverb when disabled
    this.exciterGain.gain.value = 0; // No exciter when disabled
    
    // Generate impulse response for reverb
    this.generateImpulseResponse();
  }
  
  /**
   * Create a single EQ band
   */
  private createEQBand(type: BiquadFilterType, frequency: number): BiquadFilterNode {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 1.0;
    filter.gain.value = 0;
    return filter;
  }
  
  /**
   * Create harmonic exciter curve
   * Uses soft clipping to add subtle harmonics
   */
  private createExciterCurve(): Float32Array {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping with asymmetric curve for even harmonics
      curve[i] = (3 + 0.5) * x * 20 * deg / (Math.PI + 0.5 * Math.abs(x));
    }
    
    return curve;
  }
  
  /**
   * Generate convolution reverb impulse response
   * Simulates a concert hall
   */
  private generateImpulseResponse(): void {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        const decay = Math.exp(-i / (sampleRate * 0.5));
        const noise = (Math.random() * 2 - 1) * decay;
        
        // Add early reflections
        const earlyReflection = i < sampleRate * 0.05 
          ? Math.sin(i / 100) * decay * 0.5
          : 0;
        
        channelData[i] = noise + earlyReflection;
      }
    }
    
    this.convolver.buffer = impulse;
  }
  
  /**
   * Connect audio processing chain
   */
  private connectNodes(): void {
    if (this.isConnected) return;
    
    // Main signal path: Input -> EQ chain
    this.inputGain.connect(this.eqNodes.sub);
    this.eqNodes.sub.connect(this.eqNodes.bass);
    this.eqNodes.bass.connect(this.eqNodes.mid);
    this.eqNodes.mid.connect(this.eqNodes.highMid);
    this.eqNodes.highMid.connect(this.eqNodes.treble);
    
    // After EQ, split for parallel processing
    const eqOutput = this.eqNodes.treble;
    
    // Path 1: Dry signal
    eqOutput.connect(this.dryGain);
    
    // Path 2: Spatial widening (Haas effect)
    eqOutput.connect(this.splitter);
    this.splitter.connect(this.leftDelay, 0);
    this.splitter.connect(this.rightDelay, 1);
    this.leftDelay.connect(this.merger, 0, 0);
    this.rightDelay.connect(this.merger, 0, 1);
    this.merger.connect(this.haasGain);
    
    // Path 3: Reverb
    eqOutput.connect(this.convolver);
    this.convolver.connect(this.reverbGain);
    
    // Path 4: Harmonic exciter
    eqOutput.connect(this.exciterWaveShaper);
    this.exciterWaveShaper.connect(this.exciterGain);
    
    // Merge all paths
    this.dryGain.connect(this.panner);
    this.haasGain.connect(this.panner);
    this.reverbGain.connect(this.panner);
    this.exciterGain.connect(this.panner);
    
    // 3D positioning -> Dynamics -> Output
    this.panner.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.analyzer);
    this.analyzer.connect(this.ctx.destination);
    
    this.isConnected = true;
  }
  
  /**
   * Attach to an HTML audio element
   */
  public attachToAudioElement(audioElement: HTMLAudioElement): void {
    console.log(`[SpatialAudioEngine #${this.instanceId}] Attempting to attach to audio element`);
    
    // Prevent double attachment to the same element
    if (this.audioElement === audioElement && this.source) {
      console.warn(`[SpatialAudioEngine #${this.instanceId}] Already attached to this audio element`);
      return;
    }
    
    if (this.source) {
      console.log(`[SpatialAudioEngine #${this.instanceId}] Disconnecting previous source`);
      this.source.disconnect();
      this.source = null;
    }
    
    try {
      this.audioElement = audioElement;
      this.source = this.ctx.createMediaElementSource(audioElement);
      this.source.connect(this.inputGain);
      this.connectNodes();
      console.log(`[SpatialAudioEngine #${this.instanceId}] Successfully attached to audio element`);
    } catch (error) {
      console.error(`[SpatialAudioEngine #${this.instanceId}] Failed to attach to audio element:`, error);
      // If the element is already connected, audio will play through existing connection
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.warn(`[SpatialAudioEngine #${this.instanceId}] Audio element already has a source node.`);
        console.warn(`[SpatialAudioEngine #${this.instanceId}] Audio will play without spatial effects.`);
        this.source = null;
        this.audioElement = null;
        // Don't throw - let audio play through existing connection
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Apply preset configuration
   */
  public applyPreset(preset: 'music' | 'cinema' | 'vocal'): void {
    const presetConfig = PRESETS[preset];
    if (!presetConfig) return;
    
    this.config.preset = preset;
    
    // Merge preset with current config
    if (presetConfig.eq) {
      Object.assign(this.config.eq, presetConfig.eq);
    }
    if (presetConfig.spatial) {
      Object.assign(this.config.spatial, presetConfig.spatial);
    }
    if (presetConfig.enhancement) {
      Object.assign(this.config.enhancement, presetConfig.enhancement);
    }
    
    this.updateAllParameters();
  }
  
  /**
   * Update all audio parameters with smooth transitions
   */
  private updateAllParameters(): void {
    const now = this.ctx.currentTime;
    const rampTime = 0.1; // 100ms smooth transition
    
    // Update EQ
    this.eqNodes.sub.gain.setTargetAtTime(this.config.eq.sub, now, rampTime);
    this.eqNodes.bass.gain.setTargetAtTime(this.config.eq.bass, now, rampTime);
    this.eqNodes.mid.gain.setTargetAtTime(this.config.eq.mid, now, rampTime);
    this.eqNodes.highMid.gain.setTargetAtTime(this.config.eq.highMid, now, rampTime);
    this.eqNodes.treble.gain.setTargetAtTime(this.config.eq.treble, now, rampTime);
    
    // Update spatial width (Haas effect)
    const haasDelay = this.config.spatial.width * 0.03; // Max 30ms
    this.leftDelay.delayTime.setTargetAtTime(haasDelay, now, rampTime);
    this.rightDelay.delayTime.setTargetAtTime(haasDelay, now, rampTime);
    this.haasGain.gain.setTargetAtTime(this.config.spatial.width * 0.3, now, rampTime);
    
    // Update reverb depth
    this.reverbGain.gain.setTargetAtTime(this.config.spatial.depth * 0.4, now, rampTime);
    this.dryGain.gain.setTargetAtTime(1 - this.config.spatial.depth * 0.3, now, rampTime);
    
    // Update 3D positioning
    const distance = 1 + this.config.spatial.distance * 4;
    const height = (this.config.spatial.height - 0.5) * 2;
    this.panner.setPosition(0, height, -distance);
    
    // Update exciter
    this.exciterGain.gain.setTargetAtTime(
      this.config.enhancement.exciter * 0.15,
      now,
      rampTime
    );
    
    // Update limiter
    this.limiter.threshold.setTargetAtTime(
      this.config.dynamics.limiterThreshold,
      now,
      rampTime
    );
  }
  
  /**
   * Enable/disable spatial audio
   * Note: When disabled, audio still passes through (gain = 1) but spatial effects are bypassed
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    const now = this.ctx.currentTime;
    
    // Always keep output gain at 1 to ensure audio plays
    // Instead, we control the effect by adjusting individual effect gains
    this.outputGain.gain.setTargetAtTime(1, now, 0.05);
    
    if (enabled) {
      // Enable spatial effects
      this.haasGain.gain.setTargetAtTime(this.config.spatial.width * 0.3, now, 0.05);
      this.reverbGain.gain.setTargetAtTime(this.config.spatial.depth * 0.4, now, 0.05);
      this.exciterGain.gain.setTargetAtTime(this.config.enhancement.exciter * 0.15, now, 0.05);
      this.dryGain.gain.setTargetAtTime(1 - this.config.spatial.depth * 0.3, now, 0.05);
    } else {
      // Disable spatial effects - bypass all processing
      this.haasGain.gain.setTargetAtTime(0, now, 0.05);
      this.reverbGain.gain.setTargetAtTime(0, now, 0.05);
      this.exciterGain.gain.setTargetAtTime(0, now, 0.05);
      this.dryGain.gain.setTargetAtTime(1, now, 0.05); // Full dry signal
    }
  }
  
  /**
   * Update EQ band
   */
  public setEQBand(band: keyof typeof this.config.eq, value: number): void {
    this.config.eq[band] = value;
    const node = this.eqNodes[band];
    const now = this.ctx.currentTime;
    node.gain.setTargetAtTime(value, now, 0.1);
  }
  
  /**
   * Update spatial parameter
   */
  public setSpatialParameter(param: keyof typeof this.config.spatial, value: number): void {
    this.config.spatial[param] = Math.max(0, Math.min(1, value));
    this.updateAllParameters();
  }
  
  /**
   * Get analyzer for visualization
   */
  public getAnalyzer(): AnalyserNode {
    return this.analyzer;
  }
  
  /**
   * Get frequency data for visualization
   */
  public getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(dataArray);
    return dataArray;
  }
  
  /**
   * Get time domain data for waveform
   */
  public getTimeDomainData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyzer.fftSize);
    this.analyzer.getByteTimeDomainData(dataArray);
    return dataArray;
  }
  
  /**
   * Animate spatial position based on music intensity
   */
  public animateSpatialPosition(intensity: number): void {
    const angle = Date.now() / 1000; // Rotate over time
    const radius = 0.5 + intensity * 1.5;
    
    const x = Math.cos(angle) * radius;
    const z = -2 - Math.sin(angle) * radius;
    const y = Math.sin(angle * 2) * 0.5 * intensity;
    
    this.panner.setPosition(x, y, z);
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): SpatialAudioConfig {
    return { ...this.config };
  }
  
  /**
   * Resume audio context (required after user interaction)
   */
  public async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
  
  /**
   * Cleanup and disconnect
   */
  public destroy(): void {
    console.log(`[SpatialAudioEngine #${this.instanceId}] Destroying instance`);
    
    if (this.source) {
      this.source.disconnect();
    }
    
    this.inputGain.disconnect();
    this.outputGain.disconnect();
    
    Object.values(this.eqNodes).forEach(node => node.disconnect());
    
    this.splitter.disconnect();
    this.merger.disconnect();
    this.leftDelay.disconnect();
    this.rightDelay.disconnect();
    this.haasGain.disconnect();
    this.panner.disconnect();
    this.convolver.disconnect();
    this.reverbGain.disconnect();
    this.dryGain.disconnect();
    this.exciterGain.disconnect();
    this.exciterWaveShaper.disconnect();
    this.compressor.disconnect();
    this.limiter.disconnect();
    this.analyzer.disconnect();
    
    this.isConnected = false;
  }
}
