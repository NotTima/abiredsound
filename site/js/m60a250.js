class TapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.peerPort = null;
    this.port.onmessage = (e) => {
      if (e.data && e.data.port) {
        this.peerPort = e.data.port;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }
    const ch0 = input[0];
    const ch1 = input[1] || ch0;
    const len = ch0.length;
    const mono = new Float32Array(len);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const v = (ch0[i] + ch1[i]) * 0.5;
      mono[i] = v;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / len);
    const db = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
    this.port.postMessage(db);
    if (this.peerPort) {
      this.peerPort.postMessage(mono, [mono.buffer]);
    }
    return true;
  }
}

registerProcessor('tap', TapProcessor);
