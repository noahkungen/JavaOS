package com.javaos.hardware;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;

import javax.swing.JPanel;

public class GPU extends JPanel {
    private final byte[] ram;
    private final BufferedImage screen = new BufferedImage(320, 200, BufferedImage.TYPE_INT_RGB);
    private final int[] pixels = ((DataBufferInt) screen.getRaster().getDataBuffer()).getData();
    private final int[] colors = new int[256];
    private boolean cursorVisible = true;
    private long lastCursorToggle = 0;

    public GPU(byte[] ram) {
        this.ram = ram;
        setPreferredSize(new Dimension(640, 400));
        initializePalette();
    }

    private void initializePalette() {
        colors[0] = 0x000000; colors[1] = 0x0000AA; colors[2] = 0x00AA00; colors[3] = 0x00AAAA;
        colors[4] = 0xAA0000; colors[5] = 0xAA00AA; colors[6] = 0xAA5500; colors[7] = 0xAAAAAA;
        colors[8] = 0x555555; colors[9] = 0x5555FF; colors[10]= 0x55FF55; colors[11]= 0x55FFFF;
        colors[12]= 0xFF5555; colors[13]= 0xFF55FF; colors[14]= 0xFFFF55; colors[15]= 0xFFFFFF;
    }

    // Saknad hjälpmetod fixad! Används vid avstängning (Power Down).
    public void clearScreen() {
        for (int i = 0; i < pixels.length; i++) pixels[i] = 0;
        repaint();
    }

    public void refreshLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            render();
            repaint();
            try { Thread.sleep(16); } catch (InterruptedException e) { break; }
        }
    }

    private void render() {
        for (int y = 0; y < 25; y++) {
            for (int x = 0; x < 40; x++) {
                int offset = y * 40 + x;
                int charIdx = ram[Machine.TEXT_ADDR + offset] & 0xFF;
                int colorAttr = ram[Machine.ATTR_ADDR + offset] & 0xFF;
                
                int fg = colors[colorAttr & 0x0F];
                int bg = colors[(colorAttr >> 4) & 0x0F];
                
                int baseX = x * 8;
                int baseY = y * 8;
                
                // Rendera bakgrund snabbt med DMA
                for (int row = 0; row < 8; row++) {
                    int py = baseY + row;
                    if (py >= 200) continue;
                    int pIdx = py * 320 + baseX;
                    for (int col = 0; col < 8; col++) {
                        if (baseX + col < 320) {
                            pixels[pIdx + col] = bg;
                        }
                    }
                }

                // Rendera tecken över bakgrunden snabbt med DMA
                if (charIdx != 0xFF && charIdx != 0x00 && charIdx != 0x20) {
                    int fontAddr = Machine.FONT_ADDR + (charIdx * 8);
                    for (int row = 0; row < 8; row++) {
                        int line = ram[fontAddr + row] & 0xFF;
                        if (line == 0) continue;
                        int py = baseY + row;
                        if (py >= 200) continue;
                        int pIdx = py * 320 + baseX;
                        for (int col = 0; col < 8; col++) {
                            if (((line >> (7 - col)) & 1) == 1) {
                                if (baseX + col < 320) {
                                    pixels[pIdx + col] = fg;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Rendera blinkande markör
        if (System.currentTimeMillis() - lastCursorToggle > 500) {
            cursorVisible = !cursorVisible;
            lastCursorToggle = System.currentTimeMillis();
        }
        if (cursorVisible) {
            int cx = ram[Machine.CURSOR_X_ADDR] & 0xFF;
            int cy = ram[Machine.CURSOR_Y_ADDR] & 0xFF;
            cx = Math.max(0, Math.min(39, cx));
            cy = Math.max(0, Math.min(24, cy));
            
            int colorAttr = ram[Machine.ATTR_ADDR + (cy * 40 + cx)] & 0xFF;
            int fg = colors[colorAttr & 0x0F]; 

            int py = cy * 8 + 7;
            if (py < 200) {
                int pIdx = py * 320 + cx * 8;
                for (int col = 0; col < 8; col++) {
                    if (cx * 8 + col < 320) pixels[pIdx + col] = fg;
                }
            }
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        g.drawImage(screen, 0, 0, getWidth(), getHeight(), null);
    }
}