import React, { useEffect, useRef, useMemo } from 'react';

interface ShaderBackgroundProps {
  isPlaying?: boolean;
  colors?: string[];
  shaderMode?: 'melt' | 'fluid' | 'gradient';
}

export const VISUAL_MODE_LABELS = {
  melt: '70s Melt',
  fluid: 'Fluid Noise',
  gradient: 'Gradient',
} as const;

type VisualMode = keyof typeof VISUAL_MODE_LABELS;

const LOCAL_STORAGE_KEY = 'lumison-visual-mode';

const getStoredVisualMode = (): VisualMode => {
  if (typeof window === 'undefined') return 'gradient';
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored === 'melt' || stored === 'fluid' || stored === 'gradient') return stored;
  return 'gradient';
};

const saveVisualMode = (mode: VisualMode) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, mode);
};

export const useVisualMode = () => {
  const [shaderMode, setShaderMode] = React.useState<VisualMode>(() => getStoredVisualMode());
  
  const changeShaderMode = (mode: VisualMode) => {
    setShaderMode(mode);
    saveVisualMode(mode);
    window.dispatchEvent(new CustomEvent('visual-mode-changed', { detail: mode }));
  };
  
  return { shaderMode, changeShaderMode };
};

export const onVisualModeChange = (mode: VisualMode) => {
  saveVisualMode(mode);
  window.dispatchEvent(new CustomEvent('visual-mode-changed', { detail: mode }));
};

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const meltFragmentShader = `
  precision highp float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec3 iColor1;
  uniform vec3 iColor2;
  uniform vec3 iColor3;
  uniform vec3 iColor4;

  float cosRange(float amt, float range, float minimum) {
    return (((1.0 + cos(radians(amt))) * 0.5) * range) + minimum;
  }

  void main() {
    const int zoom = 40;
    const float brightness = 0.975;

    float time = iTime * 0.05;
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = (2.0 * fragCoord.xy - iResolution.xy) / max(iResolution.x, iResolution.y);

    float ct = cosRange(time * 5.0, 3.0, 1.1);
    float xBoost = cosRange(time * 0.2, 5.0, 5.0);
    float yBoost = cosRange(time * 0.1, 10.0, 5.0);
    float fScale = cosRange(time * 15.5, 1.25, 0.5);

    for(int i = 1; i < zoom; i++) {
      float _i = float(i);
      vec2 newp = p;
      newp.x += 0.25 / _i * sin(_i * p.y + time * cos(ct) * 0.5 / 20.0 + 0.005 * _i) * fScale + xBoost;
      newp.y += 0.25 / _i * sin(_i * p.x + time * ct * 0.3 / 40.0 + 0.03 * float(i + 15)) * fScale + yBoost;
      p = newp;
    }

    float colorMix1 = 0.5 * sin(3.0 * p.x) + 0.5;
    float colorMix2 = 0.5 * sin(3.0 * p.y) + 0.5;
    float colorMix3 = sin(p.x + p.y) * 0.5 + 0.5;
    float colorMix4 = sin(p.x - p.y + 1.5) * 0.5 + 0.5;

    vec3 col = mix(
      mix(iColor1, iColor2, colorMix1),
      mix(iColor3, iColor4, colorMix4),
      colorMix2 * colorMix3
    );

    col *= brightness;

    float vigAmt = 5.0;
    float vignette = (1.0 - vigAmt * (uv.y - 0.5) * (uv.y - 0.5)) *
                    (1.0 - vigAmt * (uv.x - 0.5) * (uv.x - 0.5));
    float extrusion = (col.x + col.y + col.z) / 4.0;
    extrusion *= 1.5;
    extrusion *= vignette;

    gl_FragColor = vec4(col, extrusion);
  }
`;

const fluidFragmentShader = `
  precision highp float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec3 iColor1;
  uniform vec3 iColor2;
  uniform vec3 iColor3;
  uniform vec3 iColor4;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      f += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    float t = iTime * 0.15;
    
    vec2 p = uv * 3.0;
    float n1 = fbm(p + vec2(t * 0.5, t * 0.3));
    float n2 = fbm(p * 1.5 + vec2(-t * 0.4, t * 0.2) + n1);
    float n3 = fbm(p * 0.8 + vec2(t * 0.3, -t * 0.5) + n2 * 0.5);
    
    vec3 col1 = iColor1;
    vec3 col2 = iColor2;
    vec3 col3 = iColor3;
    vec3 col4 = iColor4;
    
    float m1 = smoothstep(0.3, 0.7, n1);
    float m2 = smoothstep(0.3, 0.7, n2);
    float m3 = smoothstep(0.3, 0.7, n3);
    
    vec3 c = mix(mix(col1, col2, m1), mix(col3, col4, m2), m3 * 0.5 + 0.5);
    
    float flow = sin(uv.y * 10.0 + t * 2.0 + n1 * 5.0) * 0.5 + 0.5;
    c += flow * 0.1;
    
    gl_FragColor = vec4(c, 1.0);
  }
`;

const gradientFragmentShader = `
  precision highp float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec3 iColor1;
  uniform vec3 iColor2;
  uniform vec3 iColor3;
  uniform vec3 iColor4;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    float t = iTime * 0.06;
    
    // 6 large slow-moving blobs at different positions and speeds
    vec2 p1 = uv + vec2(sin(t * 0.3) * 0.4, cos(t * 0.25) * 0.3);
    vec2 p2 = uv + vec2(cos(t * 0.2 + 1.0) * 0.35, sin(t * 0.3 + 1.0) * 0.4);
    vec2 p3 = uv + vec2(sin(t * 0.25 + 2.0) * 0.3, cos(t * 0.2 + 2.0) * 0.35);
    vec2 p4 = uv + vec2(cos(t * 0.35 + 3.0) * 0.45, sin(t * 0.15 + 3.0) * 0.3);
    vec2 p5 = uv + vec2(sin(t * 0.18 + 4.0) * 0.35, cos(t * 0.28 + 4.0) * 0.4);
    vec2 p6 = uv + vec2(cos(t * 0.22 + 5.0) * 0.3, sin(t * 0.32 + 5.0) * 0.35);
    
    float n1 = noise(p1 * 1.5);
    float n2 = noise(p2 * 1.8 + 10.0);
    float n3 = noise(p3 * 1.6 + 20.0);
    float n4 = noise(p4 * 1.4 + 30.0);
    float n5 = noise(p5 * 1.7 + 40.0);
    float n6 = noise(p6 * 1.5 + 50.0);
    
    // Layer colors with larger transition zones for smoother blending
    vec3 col = iColor1 * 0.25;
    col = mix(col, iColor2, smoothstep(0.25, 0.75, n1) * 0.7);
    col = mix(col, iColor3, smoothstep(0.3, 0.7, n2) * 0.6);
    col = mix(col, iColor4, smoothstep(0.35, 0.65, n3) * 0.5);
    col = mix(col, iColor1, smoothstep(0.4, 0.6, n4) * 0.35);
    col = mix(col, iColor2, smoothstep(0.3, 0.7, n5) * 0.4);
    col = mix(col, iColor3, smoothstep(0.35, 0.65, n6) * 0.3);
    
    // Very subtle ambient movement
    float flow = sin(uv.x * 1.5 + uv.y * 1.0 + t * 0.4) * 0.5 + 0.5;
    col += flow * 0.015;
    
    // Light vignette for focus
    float vigAmt = 1.5;
    float vignette = (1.0 - vigAmt * (uv.y - 0.5) * (uv.y - 0.5)) *
                    (1.0 - vigAmt * (uv.x - 0.5) * (uv.x - 0.5));
    col *= vignette * 0.2 + 0.8;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ShaderBackground: React.FC<ShaderBackgroundProps> = ({ 
  isPlaying = true, 
  colors,
  shaderMode: externalMode,
}) => {
  const [internalShaderMode, setInternalShaderMode] = React.useState<VisualMode>(() => getStoredVisualMode());
  const shaderMode = externalMode || internalShaderMode;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const pausedTimeRef = useRef<number>(0);
  const totalPausedDurationRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

  const colorKey = useMemo(() => {
    return colors && colors.length > 0 ? colors.join('|') : 'default';
  }, [colors]);

  const shaderModeKey = useMemo(() => {
    return shaderMode;
  }, [shaderMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const fragmentShaderSource = 
      shaderMode === 'fluid' ? fluidFragmentShader :
      shaderMode === 'gradient' ? gradientFragmentShader :
      meltFragmentShader;

    const createShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iTimeLocation = gl.getUniformLocation(program, 'iTime');
    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const iColor1Location = gl.getUniformLocation(program, 'iColor1');
    const iColor2Location = gl.getUniformLocation(program, 'iColor2');
    const iColor3Location = gl.getUniformLocation(program, 'iColor3');
    const iColor4Location = gl.getUniformLocation(program, 'iColor4');

    const parseColor = (colorStr: string): [number, number, number] => {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [
          parseInt(match[1]) / 255,
          parseInt(match[2]) / 255,
          parseInt(match[3]) / 255
        ];
      }
      return [0.5, 0.3, 0.7];
    };

    const color1 = colors && colors[0] ? parseColor(colors[0]) : [0.12, 0.08, 0.31];
    const color2 = colors && colors[1] ? parseColor(colors[1]) : [0.31, 0.08, 0.24];
    const color3 = colors && colors[2] ? parseColor(colors[2]) : [0.08, 0.20, 0.31];
    const color4 = colors && colors[3] ? parseColor(colors[3]) : [0.20, 0.08, 0.28];

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!isVisibleRef.current) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (!gl || !program) return;

      const currentTime = Date.now();
      let elapsedTime: number;

      if (isPlaying) {
        if (pausedTimeRef.current > 0) {
          totalPausedDurationRef.current += currentTime - pausedTimeRef.current;
          pausedTimeRef.current = 0;
        }
        elapsedTime = (currentTime - startTimeRef.current - totalPausedDurationRef.current) / 1000;
      } else {
        if (pausedTimeRef.current === 0) {
          pausedTimeRef.current = currentTime;
        }
        elapsedTime = (pausedTimeRef.current - startTimeRef.current - totalPausedDurationRef.current) / 1000;
      }

      gl.useProgram(program);
      gl.uniform1f(iTimeLocation, elapsedTime);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      gl.uniform3f(iColor1Location, color1[0], color1[1], color1[2]);
      gl.uniform3f(iColor2Location, color2[0], color2[1], color2[2]);
      gl.uniform3f(iColor3Location, color3[0], color3[1], color3[2]);
      gl.uniform3f(iColor4Location, color4[0], color4[1], color4[2]);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gl && program) {
        gl.deleteProgram(program);
      }
    };
  }, [isPlaying, colorKey, shaderModeKey]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full bg-black"
      style={{ touchAction: 'none' }}
    />
  );
};

export default ShaderBackground;