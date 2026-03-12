// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * WebGL post-processing — chromatic aberration + radial distortion.
 *
 * Ported from the ea-ux spike. Receives a captured image (data URL)
 * from the iframe (where html2canvas runs), uploads it as a WebGL
 * texture, and renders through a fragment shader with an expanding
 * shockwave ring, chromatic aberration, and rainbow prismatic fringe.
 */
export { DistortionLayer };

// ── Shaders ─────────────────────────────────────────────────

const VERT = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAG = `
  precision highp float;

  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_intensity;
  uniform float u_time;

  vec3 rainbow(float t) {
    return vec3(
      0.5 + 0.5 * cos(6.2832 * (t + 0.0)),
      0.5 + 0.5 * cos(6.2832 * (t + 0.33)),
      0.5 + 0.5 * cos(6.2832 * (t + 0.67))
    );
  }

  void main() {
    vec2 uv = v_texCoord;
    vec2 toCenter = uv - u_center;

    float aspect = u_resolution.x / u_resolution.y;
    vec2 scaled = vec2(toCenter.x * aspect, toCenter.y);
    float dist = length(scaled);

    // Expanding shockwave ring — quadratic ease-out.
    float t = clamp(u_time * 0.5, 0.0, 1.0);
    float eased = t * (2.0 - t);
    float waveRadius = eased * 1.2;
    float waveWidth = 0.08 + eased * 0.05;
    float waveDist = abs(dist - waveRadius);
    float waveFalloff = smoothstep(waveWidth, 0.0, waveDist);

    // Ripple displacement at the wavefront.
    float displaceAmount = waveFalloff * u_intensity * 0.025;
    vec2 displaceDir = normalize(toCenter + 0.001);
    vec2 displaced = uv + displaceDir * displaceAmount * sin(dist * 30.0 - u_time * 6.0);

    // Chromatic aberration concentrated at wavefront.
    float chromaAmount = waveFalloff * u_intensity * 0.012;
    vec2 rUV = displaced + displaceDir * chromaAmount;
    vec2 bUV = displaced - displaceDir * chromaAmount;

    float r = texture2D(u_texture, rUV).r;
    float g = texture2D(u_texture, displaced).g;
    float b = texture2D(u_texture, bUV).b;

    // Rainbow shockwave fringe.
    float rainbowBand = smoothstep(waveWidth * 1.2, 0.0, waveDist)
                      * smoothstep(0.0, waveWidth * 0.3, waveDist);
    vec3 prism = rainbow(dist * 3.0 - u_time * 0.5) * rainbowBand * u_intensity * 0.2;

    float vignette = 1.0 - dist * dist * u_intensity * 0.3;

    vec3 color = vec3(r, g, b) * vignette + prism;
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Class ───────────────────────────────────────────────────

class DistortionLayer {
  #canvas: HTMLCanvasElement;
  #gl: WebGLRenderingContext;
  #program: WebGLProgram;
  #texture: WebGLTexture;
  #uniforms: Record<string, WebGLUniformLocation>;
  #animationId = 0;
  #intensity = 0;
  #targetIntensity = 0;
  #centerX = 0.5;
  #centerY = 0.5;
  #startTime = performance.now();
  #onRampComplete: (() => void) | null = null;
  #onRampDown: (() => void) | null = null;
  #rampCompleted = false;

  constructor(container: HTMLElement) {
    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = `
      position: fixed;
      z-index: 52;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    `;
    container.appendChild(this.#canvas);

    const gl = this.#canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL not supported");
    this.#gl = gl;

    this.#program = this.#createProgram(VERT, FRAG);
    this.#texture = gl.createTexture()!;
    this.#uniforms = this.#getUniforms();
    this.#setupGeometry();
    this.#resize();

    window.addEventListener("resize", () => this.#resize());
    this.#startRenderLoop();
  }

  /**
   * Load a captured image and start the distortion shockwave.
   *
   * @param dataUrl  Base64 data URL from the iframe's html2canvas capture.
   * @param cx       Gesture center X (relative to bounds).
   * @param cy       Gesture center Y (relative to bounds).
   * @param bounds   The viewport area the capture covers (iframe rect).
   */
  async activate(
    dataUrl: string,
    cx: number,
    cy: number,
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<void> {
    // Decode the data URL into an Image for WebGL upload.
    const img = await this.#loadImage(dataUrl);

    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Position canvas to match the captured area (iframe bounds).
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.style.left = `${bounds.x}px`;
    this.#canvas.style.top = `${bounds.y}px`;
    this.#canvas.style.width = `${bounds.width}px`;
    this.#canvas.style.height = `${bounds.height}px`;
    this.#canvas.width = bounds.width * dpr;
    this.#canvas.height = bounds.height * dpr;
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);

    this.#centerX = cx / bounds.width;
    this.#centerY = cy / bounds.height;
    this.#intensity = 0.5;
    this.#targetIntensity = 1;
    this.#rampCompleted = false;
    this.#startTime = performance.now();
    this.#canvas.style.opacity = "1";

    return new Promise<void>((resolve) => {
      this.#onRampComplete = resolve;
    });
  }

  deactivate(): Promise<void> {
    this.#targetIntensity = 0;
    this.#rampCompleted = false;
    return new Promise<void>((resolve) => {
      this.#onRampDown = resolve;
    });
  }

  fadeOut(): void {
    this.#canvas.style.opacity = "0";
    setTimeout(() => {
      this.#targetIntensity = 0;
      this.#intensity = 0;
    }, 350);
  }

  // ── Helpers ───────────────────────────────────────────────

  get gl() { return this.#gl; }

  #loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  #resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = window.innerWidth * dpr;
    this.#canvas.height = window.innerHeight * dpr;
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #setupGeometry(): void {
    const { gl } = this;
    const positions = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    // Flip Y: html2canvas is Y-down, GL is Y-up.
    const texCoords = new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.#program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const tcBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tcBuf);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const tcLoc = gl.getAttribLocation(this.#program, "a_texCoord");
    gl.enableVertexAttribArray(tcLoc);
    gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 0, 0);
  }

  #getUniforms(): Record<string, WebGLUniformLocation> {
    const { gl } = this;
    return {
      u_texture: gl.getUniformLocation(this.#program, "u_texture")!,
      u_resolution: gl.getUniformLocation(this.#program, "u_resolution")!,
      u_center: gl.getUniformLocation(this.#program, "u_center")!,
      u_intensity: gl.getUniformLocation(this.#program, "u_intensity")!,
      u_time: gl.getUniformLocation(this.#program, "u_time")!,
    };
  }

  // ── Render Loop ───────────────────────────────────────────

  #startRenderLoop(): void {
    const render = () => {
      this.#animationId = requestAnimationFrame(render);
      this.#draw();
    };
    render();
  }

  #draw(): void {
    this.#intensity += (this.#targetIntensity - this.#intensity) * 0.1;

    if (this.#targetIntensity === 1 && this.#intensity > 0.9 && !this.#rampCompleted) {
      setTimeout(() => {
        this.#rampCompleted = true;
        this.#onRampComplete?.();
        this.#onRampComplete = null;
      }, 400);
    }

    if (this.#targetIntensity === 0 && this.#intensity < 0.02) {
      this.#intensity = 0;
      this.#canvas.style.opacity = "0";
      this.#onRampDown?.();
      this.#onRampDown = null;
      return;
    }

    if (this.#intensity < 0.001) return;

    const { gl } = this;
    const time = (performance.now() - this.#startTime) / 1000;

    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.uniform1i(this.#uniforms.u_texture, 0);
    gl.uniform2f(this.#uniforms.u_resolution, window.innerWidth, window.innerHeight);
    gl.uniform2f(this.#uniforms.u_center, this.#centerX, this.#centerY);
    gl.uniform1f(this.#uniforms.u_intensity, this.#intensity);
    gl.uniform1f(this.#uniforms.u_time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Shader Compilation ────────────────────────────────────

  #createProgram(vert: string, frag: string): WebGLProgram {
    const { gl } = this;
    const vs = this.#compileShader(vert, gl.VERTEX_SHADER);
    const fs = this.#compileShader(frag, gl.FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Link failed");
    }
    return program;
  }

  #compileShader(source: string, type: number): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "Compile failed");
    }
    return shader;
  }

  destroy(): void {
    cancelAnimationFrame(this.#animationId);
    this.#canvas.remove();
  }
}
