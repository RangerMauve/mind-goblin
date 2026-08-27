declare module "node-cpal" {
  interface AudioDevice {
    name: string;
    hostId: string;
    deviceId: string;
    isDefaultInput: boolean;
    isDefaultOutput: boolean;
    supportedInputConfigs?: AudioDeviceConfig[];
    supportedOutputConfigs?: AudioDeviceConfig[];
  }

  interface AudioHost {
    id: string;
    name: string;
  }

  interface StreamConfig {
    sampleRate: number;
    channels: number;
    format: "i16" | "u16" | "f32";
  }

  interface AudioDeviceConfig {
    minSampleRate: number;
    maxSampleRate: number;
    channels: number;
    sampleFormat: "i16" | "u16" | "f32";
  }

  interface StreamHandle {
    deviceId: string;
    streamId: string;
  }

  export function getHosts(): AudioHost[];
  export function getDevices(hostId?: string): AudioDevice[];
  export function getDefaultInputDevice(): AudioDevice;
  export function getDefaultOutputDevice(): AudioDevice;

  export function getSupportedInputConfigs(
    deviceId: string,
  ): AudioDeviceConfig[];
  export function getSupportedOutputConfigs(
    deviceId: string,
  ): AudioDeviceConfig[];
  export function getDefaultInputConfig(deviceId: string): StreamConfig;
  export function getDefaultOutputConfig(deviceId: string): StreamConfig;

  export function createStream(
    deviceId: string,
    isInput: boolean,
    config: StreamConfig,
    onData?: (data: Float32Array) => void,
  ): StreamHandle;
  export function writeToStream(
    streamHandle: StreamHandle,
    data: Float32Array,
  ): void;
  export function pauseStream(streamHandle: StreamHandle): void;
  export function resumeStream(streamHandle: StreamHandle): void;
  export function closeStream(streamHandle: StreamHandle): void;
  export function isStreamActive(streamHandle: StreamHandle): boolean;
}
