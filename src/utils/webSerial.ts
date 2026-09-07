// Web Serial API manager for direct USB connection to ESP32 / Arduino

export interface WebSerialStatus {
  isSupported: boolean;
  isConnected: boolean;
  portName: string | null;
  packetsReceived: number;
  lastPacketTimestamp: string | null;
  error: string | null;
}

let activePort: any = null;
let activeReader: any = null;
let keepReading = false;
let packetsCount = 0;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export async function connectWebSerial(
  onLineReceived: (line: string) => void,
  onStatusChange: (status: WebSerialStatus) => void
): Promise<{ success: boolean; message: string; isIframeBlocked?: boolean }> {
  if (!isWebSerialSupported()) {
    return {
      success: false,
      message: 'Web Serial API is not supported by your browser. Please use Google Chrome or Microsoft Edge.'
    };
  }

  // Modern browsers strictly disallow the "serial" feature inside embedded iframes
  if (isRunningInIframe()) {
    return {
      success: false,
      isIframeBlocked: true,
      message: 'Direct USB serial access is restricted inside preview iframes by browser security policies. Please open this app in a New Tab or use the WiFi Supabase Cloud Stream.'
    };
  }

  try {
    const navSerial = (navigator as any).serial;
    const port = await navSerial.requestPort();

    // Standard ESP32 / NodeMCU baud rate
    await port.open({ baudRate: 115200 });
    activePort = port;
    keepReading = true;
    packetsCount = 0;

    const info = port.getInfo?.() || {};
    const portLabel = info.usbVendorId ? `USB Device (VID: 0x${info.usbVendorId.toString(16)})` : 'COM Port';

    onStatusChange({
      isSupported: true,
      isConnected: true,
      portName: portLabel,
      packetsReceived: 0,
      lastPacketTimestamp: new Date().toISOString(),
      error: null,
    });

    // Start background reader loop
    readLoop(port, onLineReceived, onStatusChange, portLabel);

    return {
      success: true,
      message: `Successfully connected to ${portLabel} at 115200 baud.`
    };
  } catch (err: any) {
    const isPermissionsPolicy =
      err.name === 'SecurityError' ||
      (typeof err.message === 'string' && (
        err.message.toLowerCase().includes('permissions policy') ||
        err.message.toLowerCase().includes('disallowed')
      ));

    if (isPermissionsPolicy) {
      console.info('Web Serial blocked by iframe permissions policy. Advise user to open in new tab or use Supabase.');
      return {
        success: false,
        isIframeBlocked: true,
        message: 'Browser permissions policy blocks USB access inside preview frames. Please open the app in a New Tab to connect via USB, or use WiFi Supabase Cloud Streaming.'
      };
    }

    if (err.name === 'NotFoundError') {
      return {
        success: false,
        message: 'No serial device was selected.'
      };
    }

    const errMsg = err.message || '';
    if (errMsg.toLowerCase().includes('failed to open serial port') || err.name === 'InvalidStateError') {
      return {
        success: false,
        message: 'Failed to open serial port. The COM port is locked by another program (e.g. Arduino Serial Monitor, VSCode, or another browser tab). Close Arduino IDE/Serial Monitor and try again.'
      };
    }

    console.warn('Web Serial connection note:', err.message || err);
    return {
      success: false,
      message: err.message || 'Failed to open serial port.'
    };
  }
}

async function readLoop(
  port: any,
  onLineReceived: (line: string) => void,
  onStatusChange: (status: WebSerialStatus) => void,
  portLabel: string
) {
  let textDecoder: TextDecoderStream | null = null;
  let readableStreamClosed: Promise<void> | null = null;
  let buffer = '';

  try {
    textDecoder = new TextDecoderStream();
    readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    activeReader = reader;

    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        buffer += value;
        const lines = buffer.split(/[\r\n]+/);
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            packetsCount++;
            onLineReceived(trimmed);
            onStatusChange({
              isSupported: true,
              isConnected: true,
              portName: portLabel,
              packetsReceived: packetsCount,
              lastPacketTimestamp: new Date().toISOString(),
              error: null,
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('Web Serial stream interrupted:', err);
  } finally {
    if (activeReader) {
      try {
        await activeReader.cancel();
      } catch (e) {}
      activeReader = null;
    }
    if (readableStreamClosed) {
      try {
        await readableStreamClosed.catch(() => {});
      } catch (e) {}
    }
    onStatusChange({
      isSupported: true,
      isConnected: false,
      portName: null,
      packetsReceived: packetsCount,
      lastPacketTimestamp: null,
      error: null,
    });
  }
}

export async function disconnectWebSerial(): Promise<void> {
  keepReading = false;
  if (activeReader) {
    try {
      await activeReader.cancel();
    } catch (e) {}
    activeReader = null;
  }
  if (activePort) {
    try {
      await activePort.close();
    } catch (e) {}
    activePort = null;
  }
}
