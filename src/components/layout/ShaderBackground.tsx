import React, { useEffect, useRef, useMemo } from 'react';

interface ShaderBackgroundProps {
  isPlaying?: boolean;
  colors?: string[];
}

const ShaderBackground: React.FC<ShaderBackgroundProps> = ({ isPlaying = true, colors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const pausedTimeRef = useRef<number>(0);
  const totalPausedDurationRef = useRef<number>(0);

  // Memoize colors to prevent unnecessary re-renders
  const colorKey = useMemo(() => {
    return colors && colors.length > 0 ? colors.join('|') : 'default';
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader - 70s Melt with color support
    const fragmentShaderSource = `
      precision highp float;

      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 iColor1;
      uniform vec3 iColor2;
      uniform vec3 iColor3;

      float cosRange(float amt, float range, float minimum) {
        return (((1.0 + cos(radians(amt))) * 0.5) * range) + minimum;
      }

      void main() {
        const int zoom = 40;
        const float brightness = 0.975;
        
        float time = iTime * 0.5;
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
        
        // Use cover colors instead of fixed colors
        float colorMix1 = 0.5 * sin(3.0 * p.x) + 0.5;
        float colorMix2 = 0.5 * sin(3.0 * p.y) + 0.5;
        float colorMix3 = sin(p.x + p.y) * 0.5 + 0.5;
        
        vec3 col = mix(
          mix(iColor1, iColor2, colorMix1),
          iColor3,
          colorMix2 * colorMix3
        );
        
        col *= brightness;
        
        // Add border vignette
        float vigAmt = 5.0;
        float vignette = (1.0 - vigAmt * (uv.y - 0.5) * (uv.y - 0.5)) * 
                        (1.0 - vigAmt * (uv.x - 0.5) * (uv.x - 0.5));
        float extrusion = (col.x + col.y + col.z) / 4.0;
        extrusion *= 1.5;
        extrusion *= vignette;
        
        gl_FragColor = vec4(col, extrusion);
      }
    `;

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

    // Setup geometry
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

    // Get uniform locations
    const iTimeLocation = gl.getUniformLocation(program, 'iTime');
    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const iColor1Location = gl.getUniformLocation(program, 'iColor1');
    const iColor2Location = gl.getUniformLocation(program, 'iColor2');
    const iColor3Location = gl.getUniformLocation(program, 'iColor3');

    // Parse colors from RGB strings
    const parseColor = (colorStr: string): [number, number, number] => {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [
          parseInt(match[1]) / 255,
          parseInt(match[2]) / 255,
          parseInt(match[3]) / 255
        ];
      }
      return [0.5, 0.3, 0.7]; // Default purple
    };

    const color1 = colors && colors[0] ? parseColor(colors[0]) : [0.5, 0.3, 0.7];
    const color2 = colors && colors[1] ? parseColor(colors[1]) : [0.7, 0.3, 0.5];
    const color3 = colors && colors[2] ? parseColor(colors[2]) : [0.3, 0.5, 0.7];

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
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

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gl && program) {
        gl.deleteProgram(program);
      }
    };
  }, [isPlaying, colorKey]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full bg-black"
      style={{ touchAction: 'none' }}
    />
  );
};

export default ShaderBackground;
