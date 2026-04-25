/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Audio I/O for Gemini Live API sessions.
 *
 * **AudioInput** captures microphone audio via an AudioWorklet, downsamples
 * to 16kHz 16-bit PCM, base64-encodes each chunk, and delivers it via a
 * callback for streaming to the Live API WebSocket.
 *
 * **AudioOutput** receives base64-encoded 24kHz 16-bit PCM from the Live
 * API, decodes it, and plays it through an AudioContext with seamless
 * buffer stitching.
 */

export { AudioInput, AudioOutput };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode an Int16Array to a base64 string. */
function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string to an Int16Array. */
function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

// ---------------------------------------------------------------------------
// AudioInput — mic → PCM → base64
// ---------------------------------------------------------------------------

/** Callback for each audio chunk ready to send over WebSocket. */
type OnChunkCallback = (base64Pcm: string) => void;

/** Called when the audio gate closes, signaling end of user speech. */
type OnStreamEndCallback = () => void;

class AudioInput {
  #context: AudioContext | null = null;
  #stream: MediaStream | null = null;
  #workletNode: AudioWorkletNode | null = null;
  #onChunk: OnChunkCallback;
  #onStreamEnd: OnStreamEndCallback;
  #running = false;

  /**
   * When true (default), PCM chunks from the worklet are discarded.
   * The mic capture stays running to avoid getUserMedia latency on
   * each Talk press — we just gate whether chunks flow to the callback.
   */
  #gated = true;

  constructor(onChunk: OnChunkCallback, onStreamEnd: OnStreamEndCallback) {
    this.#onChunk = onChunk;
    this.#onStreamEnd = onStreamEnd;
  }

  get running(): boolean {
    return this.#running;
  }

  get gated(): boolean {
    return this.#gated;
  }

  /** Open the gate — audio chunks start flowing to the callback. */
  openGate(): void {
    this.#gated = false;
  }

  /**
   * Close the gate — audio chunks stop flowing.
   * Fires the onStreamEnd callback so the caller can send audioStreamEnd.
   */
  closeGate(): void {
    if (!this.#gated) {
      this.#gated = true;
      this.#onStreamEnd();
    }
  }

  /** Start capturing microphone audio. */
  async start(): Promise<void> {
    if (this.#running) return;

    // Request mic access.
    this.#stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 48000 },
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Create AudioContext and load the worklet processor.
    this.#context = new AudioContext({ sampleRate: 48000 });

    const workletUrl = new URL(
      "./pcm-capture-processor.js",
      import.meta.url,
    );
    await this.#context.audioWorklet.addModule(workletUrl);

    // Wire: mic → worklet.
    const source = this.#context.createMediaStreamSource(this.#stream);
    this.#workletNode = new AudioWorkletNode(
      this.#context,
      "pcm-capture-processor",
    );

    // Receive PCM chunks from the worklet thread.
    let chunkCount = 0;
    this.#workletNode.port.onmessage = (event: MessageEvent) => {
      // Gate: discard chunks when the user isn't talking.
      if (this.#gated) return;

      const pcm = event.data.pcm as Int16Array;
      if (pcm && pcm.length > 0) {
        chunkCount++;
        // Log amplitude every ~1 second (10 chunks × 100ms).
        if (chunkCount % 10 === 0) {
          let maxAmp = 0;
          for (let i = 0; i < pcm.length; i++) {
            const abs = Math.abs(pcm[i]);
            if (abs > maxAmp) maxAmp = abs;
          }
          console.log(
            `[audio-input] chunk #${chunkCount}: ${pcm.length} samples, peak=${maxAmp}`,
          );
        }
        this.#onChunk(int16ToBase64(pcm));
      }
    };

    source.connect(this.#workletNode);
    // The worklet doesn't produce audio output — connect to a dummy
    // destination to keep the graph alive.
    this.#workletNode.connect(this.#context.destination);

    this.#running = true;
    console.log("[audio-input] Mic capture started");
  }

  /** Stop capturing and release resources. */
  stop(): void {
    if (!this.#running) return;

    // Close the gate if still open.
    if (!this.#gated) {
      this.#gated = true;
    }

    this.#workletNode?.disconnect();
    this.#workletNode = null;

    if (this.#stream) {
      for (const track of this.#stream.getTracks()) {
        track.stop();
      }
      this.#stream = null;
    }

    if (this.#context) {
      void this.#context.close();
      this.#context = null;
    }

    this.#running = false;
    console.log("[audio-input] Mic capture stopped");
  }
}

// ---------------------------------------------------------------------------
// AudioOutput — base64 PCM → speakers
// ---------------------------------------------------------------------------

/** Sample rate of audio received from the Live API. */
const OUTPUT_SAMPLE_RATE = 24000;

class AudioOutput {
  #context: AudioContext | null = null;
  /** Scheduled end time of the last queued buffer. */
  #nextStartTime = 0;

  /** Ensure the AudioContext is ready. */
  #ensureContext(): AudioContext {
    if (!this.#context) {
      this.#context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.#nextStartTime = 0;
    }
    return this.#context;
  }

  /**
   * Enqueue a base64-encoded PCM chunk for playback.
   *
   * Chunks are stitched seamlessly — each new buffer is scheduled to
   * start exactly when the previous one ends.
   */
  play(base64Pcm: string): void {
    const ctx = this.#ensureContext();

    // Decode base64 → Int16 → Float32.
    const int16 = base64ToInt16(base64Pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    // Create an AudioBuffer.
    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    // Schedule playback.
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, this.#nextStartTime);
    source.start(startTime);
    this.#nextStartTime = startTime + buffer.duration;
  }

  /** Stop all playback and flush the queue. */
  flush(): void {
    if (this.#context) {
      void this.#context.close();
      this.#context = null;
      this.#nextStartTime = 0;
    }
  }

  /** Release resources. */
  dispose(): void {
    this.flush();
  }
}
