import { BEEP_CMD_ADDR, BEEP_DUR_ADDR, BEEP_FREQ_ADDR } from "./constants";

export class AudioCard {
  private audioCtx: AudioContext | null = null;

  public tick(ram: Uint8Array) {
    const cmd = ram[BEEP_CMD_ADDR] & 0xFF;
    if (cmd === 1) {
      const freq = ((ram[BEEP_FREQ_ADDR] & 0xFF) << 8) | (ram[BEEP_FREQ_ADDR + 1] & 0xFF);
      const dur = ((ram[BEEP_DUR_ADDR] & 0xFF) << 8) | (ram[BEEP_DUR_ADDR + 1] & 0xFF);
      ram[BEEP_CMD_ADDR] = 2;

      this.playTone(freq, dur).then(() => {
        ram[BEEP_CMD_ADDR] = 0;
      });
    }
  }

  private async playTone(freq: number, durationMs: number) {
    if (freq <= 0 || durationMs <= 0) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime); // 20% volume
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      oscillator.start();
      
      await new Promise(resolve => setTimeout(resolve, durationMs));
      
      oscillator.stop();
    } catch (e) {
      console.warn("Audio error", e);
    }
  }
}
