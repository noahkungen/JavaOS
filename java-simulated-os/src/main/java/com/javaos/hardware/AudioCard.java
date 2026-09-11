package com.javaos.hardware;

import javax.sound.sampled.*;

public class AudioCard {
    public static final int BEEP_FREQ_ADDR = 0xA0040;
    public static final int BEEP_DUR_ADDR  = 0xA0042;
    public static final int BEEP_CMD_ADDR  = 0xA0044;

    public void tick(byte[] ram) {
        int cmd = ram[BEEP_CMD_ADDR] & 0xFF;
        if (cmd == 1) {
            int freq = ((ram[BEEP_FREQ_ADDR] & 0xFF) << 8) | (ram[BEEP_FREQ_ADDR+1] & 0xFF);
            int dur = ((ram[BEEP_DUR_ADDR] & 0xFF) << 8) | (ram[BEEP_DUR_ADDR+1] & 0xFF);
            ram[BEEP_CMD_ADDR] = (byte) 2; 
            new Thread(() -> {
                playTone(freq, dur);
                ram[BEEP_CMD_ADDR] = 0;
            }).start();
        }
    }

    private void playTone(int freq, int durationMs) {
        if (freq <= 0 || durationMs <= 0) return;
        try {
            float sampleRate = 44100f;
            byte[] buf = new byte[1];
            AudioFormat af = new AudioFormat(sampleRate, 8, 1, true, false);
            SourceDataLine sdl = AudioSystem.getSourceDataLine(af);
            sdl.open(af);
            sdl.start();
            for (int i = 0; i < durationMs * sampleRate / 1000; i++) {
                double angle = i / (sampleRate / freq) * 2.0 * Math.PI;
                buf[0] = (byte) (Math.sin(angle) * 50.0);
                sdl.write(buf, 0, 1);
            }
            sdl.drain();
            sdl.close();
        } catch (Exception ignored) {}
    }
}