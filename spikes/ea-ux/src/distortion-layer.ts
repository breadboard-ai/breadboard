/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebGL post-processing layer for chromatic aberration + radial distortion.
 *
 * Captures the projection surface as a texture using html2canvas,
 * then renders it through a fragment shader that splits RGB channels
 * with radial distortion emanating from the gesture center.
 *
 * This is theme-agnostic: it distorts existing pixels, not overlays.
 */
export { DistortionLayer };

import html2canvas from "html2canvas";

// ─── Shaders ────────────────────────────────────────────────

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

  // Rainbow color from angle — thin-film interference look.
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

    // Correct for aspect ratio so the ring is circular.
    float aspect = u_resolution.x / u_resolution.y;
    vec2 scaled = vec2(toCenter.x * aspect, toCenter.y);
    float dist = length(scaled);

    // Expanding shockwave ring — quadratic ease-out (immediate start, decelerates).
    float t = clamp(u_time * 0.5, 0.0, 1.0);
    float eased = t * (2.0 - t);  // quadratic ease-out
    float waveRadius = eased * 1.2;
    float waveWidth = 0.08 + eased * 0.05;
    float waveDist = abs(dist - waveRadius);
    float waveFalloff = smoothstep(waveWidth, 0.0, waveDist);

    // Ripple displacement — radial push at the wavefront.
    float displaceAmount = waveFalloff * u_intensity * 0.025;
    vec2 displaceDir = normalize(toCenter + 0.001);
    vec2 displaced = uv + displaceDir * displaceAmount * sin(dist * 30.0 - u_time * 6.0);

    // Chromatic aberration concentrated at the wavefront.
    float chromaAmount = waveFalloff * u_intensity * 0.012;
    vec2 rUV = displaced + displaceDir * chromaAmount;
    vec2 bUV = displaced - displaceDir * chromaAmount;

    float r = texture2D(u_texture, rUV).r;
    float g = texture2D(u_texture, displaced).g;
    float b = texture2D(u_texture, bUV).b;

    // Rainbow shockwave fringe — subtle prismatic band.
    float rainbowBand = smoothstep(waveWidth * 1.2, 0.0, waveDist)
                      * smoothstep(0.0, waveWidth * 0.3, waveDist);
    vec3 prism = rainbow(dist * 3.0 - u_time * 0.5) * rainbowBand * u_intensity * 0.2;

    // Gentle vignette.
    float vignette = 1.0 - dist * dist * u_intensity * 0.3;

    vec3 color = vec3(r, g, b) * vignette + prism;
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Class ──────────────────────────────────────────────────

class DistortionLayer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation>;
  private animationId = 0;
  private intensity = 0;
  private targetIntensity = 0;
  private centerX = 0.5;
  private centerY = 0.5;
  private startTime = performance.now();
  private onRampComplete: (() => void) | null = null;
  private onRampDown: (() => void) | null = null;
  private rampCompleted = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "distortion-canvas";
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 13;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    `;
    document.getElementById("app")!.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;

    this.program = this.createProgram(VERT, FRAG);
    this.texture = gl.createTexture()!;
    this.uniforms = this.getUniforms();
    this.setupGeometry();
    this.resize();

    window.addEventListener("resize", () => this.resize());
    this.startRenderLoop();
  }

  /**
   * Capture the DOM element, upload as texture, and start the distortion.
   * @param source The DOM element to capture.
   * @param cx Gesture center X in screen pixels.
   * @param cy Gesture center Y in screen pixels.
   */
  async activate(source: HTMLElement, cx: number, cy: number): Promise<void> {
    // Capture DOM to canvas.
    const snapshot = await html2canvas(source, {
      backgroundColor: "#0a0a0f",
      scale: window.devicePixelRatio,
      logging: false,
      useCORS: true,
    });

    // Upload to WebGL texture.
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      snapshot
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Set center in UV coordinates (texCoords already flip Y).
    this.centerX = cx / window.innerWidth;
    this.centerY = cy / window.innerHeight;
    // Start with visible intensity so distortion is immediate.
    this.intensity = 0.5;
    this.targetIntensity = 1;
    this.rampCompleted = false;
    this.startTime = performance.now();
    this.canvas.style.opacity = "1";
    console.log(
      "[distortion] activated at",
      cx,
      cy,
      "→ UV",
      this.centerX.toFixed(2),
      this.centerY.toFixed(2)
    );

    // Return a promise that resolves when distortion reaches ~90%.
    return new Promise<void>((resolve) => {
      this.onRampComplete = resolve;
    });
  }

  /** Ramp distortion down and resolve when complete. */
  deactivate(): Promise<void> {
    this.targetIntensity = 0;
    this.rampCompleted = false;
    return new Promise<void>((resolve) => {
      this.onRampDown = resolve;
    });
  }

  /** Fade the WebGL canvas out over ~300ms (CSS transition). */
  fadeOut(): void {
    this.canvas.style.opacity = "0";
    // Stop rendering after transition completes.
    setTimeout(() => {
      this.targetIntensity = 0;
      this.intensity = 0;
    }, 350);
  }

  /** Hide immediately (no fade). */
  hideImmediate(): void {
    this.targetIntensity = 0;
    this.intensity = 0;
    this.canvas.style.opacity = "0";
  }

  // ─── Setup ──────────────────────────────────────────────────

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private setupGeometry(): void {
    const { gl } = this;

    // Full-screen quad.
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    // Flip Y so html2canvas (Y-down) matches GL (Y-up).
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const tcBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tcBuf);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const tcLoc = gl.getAttribLocation(this.program, "a_texCoord");
    gl.enableVertexAttribArray(tcLoc);
    gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 0, 0);
  }

  private getUniforms(): Record<string, WebGLUniformLocation> {
    const { gl, program } = this;
    return {
      u_texture: gl.getUniformLocation(program, "u_texture")!,
      u_resolution: gl.getUniformLocation(program, "u_resolution")!,
      u_center: gl.getUniformLocation(program, "u_center")!,
      u_intensity: gl.getUniformLocation(program, "u_intensity")!,
      u_time: gl.getUniformLocation(program, "u_time")!,
    };
  }

  // ─── Render Loop ──────────────────────────────────────────

  private startRenderLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.draw();
    };
    render();
  }

  private draw(): void {
    // Smooth intensity towards target.
    this.intensity += (this.targetIntensity - this.intensity) * 0.1;

    // Fire ramp-complete callback — let the ripple play out fully.
    if (
      this.targetIntensity === 1 &&
      this.intensity > 0.9 &&
      !this.rampCompleted
    ) {
      // Wait an extra beat so the ring expands before blur comes in.
      setTimeout(() => {
        console.log(
          "[distortion] ramp complete at intensity",
          this.intensity.toFixed(2)
        );
        this.rampCompleted = true;
        this.onRampComplete?.();
        this.onRampComplete = null;
      }, 400);
    }

    // Fire ramp-down callback when intensity is near zero.
    if (this.targetIntensity === 0 && this.intensity < 0.02) {
      this.intensity = 0;
      this.canvas.style.opacity = "0";
      this.onRampDown?.();
      this.onRampDown = null;
      return;
    }

    const { gl } = this;

    if (this.intensity < 0.001) {
      return; // Nothing to render.
    }

    const time = (performance.now() - this.startTime) / 1000;

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.u_texture, 0);
    gl.uniform2f(
      this.uniforms.u_resolution,
      window.innerWidth,
      window.innerHeight
    );
    gl.uniform2f(this.uniforms.u_center, this.centerX, this.centerY);
    gl.uniform1f(this.uniforms.u_intensity, this.intensity);
    gl.uniform1f(this.uniforms.u_time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ─── Shader Compilation ───────────────────────────────────

  private createProgram(vert: string, frag: string): WebGLProgram {
    const { gl } = this;
    const vs = this.compileShader(vert, gl.VERTEX_SHADER);
    const fs = this.compileShader(frag, gl.FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Link failed");
    }
    return program;
  }

  private compileShader(source: string, type: number): WebGLShader {
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
    cancelAnimationFrame(this.animationId);
    this.canvas.remove();
  }
}
