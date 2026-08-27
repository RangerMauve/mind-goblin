declare module "sherpa-onnx-node" {
  export class Vad {
    constructor(config: VadConfig, bufferSizeInSeconds: number);
    readonly config: VadConfig;
    acceptWaveform(samples: Float32Array): void;
    isEmpty(): boolean;
    isDetected(): boolean;
    pop(): void;
    front(): { start: number; samples: Float32Array };
    clear(): void;
    reset(): void;
    flush(): void;
  }

  export class CircularBuffer {
    constructor(size: number);
    push(samples: Float32Array): void;
    pop(n: number): void;
    get(start: number, n: number): Float32Array;
    size(): number;
    head(): number;
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig);
    readonly config: OfflineRecognizerConfig;
    static createAsync(
      config: OfflineRecognizerConfig,
    ): Promise<OfflineRecognizer>;
    createStream(hotwords?: string): OfflineStream;
    decode(stream: OfflineStream): void;
    getResult(stream: OfflineStream): OfflineRecognizerResult;
  }

  export class OfflineStream {
    acceptWaveform(obj: { samples: Float32Array; sampleRate: number }): void;
  }

  export class LinearResampler {
    constructor(inputSampleRate: number, outputSampleRate: number);
    resample(samples: Float32Array): Float32Array;
    flush(samples: Float32Array): Float32Array;
  }

  export function writeWave(
    filename: string,
    obj: { samples: Float32Array; sampleRate: number },
  ): void;

  interface VadConfig {
    sileroVad?: SileroVadConfig;
    sampleRate?: number;
    numThreads?: number;
    provider?: string;
    debug?: boolean | number;
  }

  interface SileroVadConfig {
    model: string;
    threshold?: number;
    minSilenceDuration?: number;
    minSpeechDuration?: number;
    windowSize?: number;
    maxSpeechDuration?: number;
  }

  interface OfflineRecognizerConfig {
    featConfig?: {
      sampleRate?: number;
      featureDim?: number;
    };
    modelConfig?: {
      tokens?: string;
      numThreads?: number;
      provider?: string;
      moonshine?: {
        preprocessor?: string;
        encoder?: string;
        uncachedDecoder?: string;
        cachedDecoder?: string;
      };
      whisper?: {
        encoder?: string;
        decoder?: string;
      };
      transducer?: {
        encoder?: string;
        decoder?: string;
        joiner?: string;
      };
      senseVoice?: {
        model?: string;
        language?: string;
        useInverseTextNormalization?: number;
      };
    };
  }

  interface OfflineRecognizerResult {
    text: string;
    tokens: string[];
    timestamps: number[];
    lang?: string;
    emotion?: string;
  }
}
