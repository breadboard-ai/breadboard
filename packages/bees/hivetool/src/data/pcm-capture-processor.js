/**
 * AudioWorklet processor for PCM capture.
 *
 * Runs on the audio rendering thread. Collects float32 samples from
 * the microphone, downsamples to 16kHz, converts to 16-bit integers,
 * and posts chunks (~100ms) to the main thread.
 */

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array[]} */
    this._buffer = [];
    this._samplesBuffered = 0;
    this._targetRate = 16000;
    // Chunk size: ~100ms at 16kHz = 1600 samples.
    this._chunkSize = 1600;
  }

  /**
   * @param {Float32Array[][]} inputs
   * @returns {boolean}
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Take mono channel (first channel).
    const samples = input[0];
    if (!samples || samples.length === 0) return true;

    // Downsample: sampleRate → 16kHz using linear interpolation.
    const ratio = sampleRate / this._targetRate;
    const outputLength = Math.floor(samples.length / ratio);
    const resampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, samples.length - 1);
      const frac = srcIndex - low;
      resampled[i] = samples[low] * (1 - frac) + samples[high] * frac;
    }

    this._buffer.push(resampled);
    this._samplesBuffered += resampled.length;

    // Flush when we have enough for a chunk.
    if (this._samplesBuffered >= this._chunkSize) {
      this._flush();
    }

    return true;
  }

  _flush() {
    // Concatenate buffered samples.
    const merged = new Float32Array(this._samplesBuffered);
    let offset = 0;
    for (const buf of this._buffer) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    // Convert float32 [-1, 1] → int16.
    const int16 = new Int16Array(merged.length);
    for (let i = 0; i < merged.length; i++) {
      const clamped = Math.max(-1, Math.min(1, merged[i]));
      int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Post to main thread (transfer the buffer for zero-copy).
    this.port.postMessage(
      { pcm: int16 },
      [int16.buffer],
    );

    this._buffer = [];
    this._samplesBuffered = 0;
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
