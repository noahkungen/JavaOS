package com.javaos.hardware;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * JavaOS Iron v14.00 [Modular Architecture].
 * Architecture:
 * - Hardware components (Disk, Audio, Network) isolated into pluggable Java cards.
 * - The entire OS Assembly is extracted and dynamically loaded from the `/os` directory.
 * - Machine.java acts solely as a physical motherboard and KVM GUI.
 */
public class Machine extends JFrame {
    private static final long serialVersionUID = 1L;
    
    public static final int MEM_SIZE = 1024 * 1024; 
    public static final int KBD_ADDR = 0xA000;      
    public static final int VRAM_ADDR = 0x80000;    
    public static final int TEXT_ADDR = 0xB8000;    
    public static final int ATTR_ADDR = 0xB9000;    
    public static final int FONT_ADDR = 0xE0000;    
    public static final int ROM_ADDR = 0xF0000;
    
    public static final int CURSOR_X_ADDR = 0xA0010;
    public static final int CURSOR_Y_ADDR = 0xA0011;
    public static final int COLOR_STATE   = 0xA0012; 
    
    public static final int RTC_YEAR_HI_ADDR = 0xA0030;
    public static final int RTC_YEAR_LO_ADDR = 0xA0031;
    public static final int RTC_MONTH_ADDR   = 0xA0032;
    public static final int RTC_DAY_ADDR     = 0xA0033;
    public static final int RTC_HOUR_ADDR    = 0xA0034;
    public static final int RTC_MIN_ADDR     = 0xA0035;
    public static final int RTC_SEC_ADDR     = 0xA0036;
    public static final int CMOS_ADDR = 0x003F0; 

    private final String CMOS_FILENAME = "cmos.bin";
    private String currentIsoPath = "iron_recovery_cd.iso";
    
    // Motherboard Components
    private final byte[] ram = new byte[MEM_SIZE];
    private CPU cpu;
    private final GPU gpu;
    private final DiskController diskController;
    private final NetworkCard networkCard;
    private final AudioCard audioCard;
    
    private boolean poweredOn = false;
    private byte lastCmos = 0;

    // Hardware Threads
    private Thread vCpuThread;
    private Thread vGpuThread;
    private Thread vTimerThread;

    private final ConcurrentLinkedQueue<Integer> kbdBuffer = new ConcurrentLinkedQueue<>();

    public Machine() {
        this.diskController = new DiskController();
        this.networkCard = new NetworkCard();
        this.audioCard = new AudioCard();
        this.cpu = new CPU(ram);
        this.gpu = new GPU(ram);
        
        setTitle("JavaOS Iron v14.00 [Modular Motherboard]");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);
        add(gpu, BorderLayout.CENTER);
        
        setupKvmMenu();
        pack();
        setLocationRelativeTo(null);

        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (!poweredOn || cpu.isPanic()) return;
                int c = e.getKeyChar();
                
                if (e.isControlDown()) {
                    if (c == 's' || c == 'S' || c == 19) c = 132;
                    else if (c == 'x' || c == 'X' || c == 24) c = 133;
                } else if (e.getKeyCode() == KeyEvent.VK_LEFT) c = 128;
                else if (e.getKeyCode() == KeyEvent.VK_RIGHT) c = 129;
                else if (e.getKeyCode() == KeyEvent.VK_UP) c = 130;
                else if (e.getKeyCode() == KeyEvent.VK_DOWN) c = 131;
                else if (e.getKeyCode() == KeyEvent.VK_ESCAPE) c = 27;
                else if (c == '\r') c = '\n';
                else if (e.getKeyCode() == KeyEvent.VK_BACK_SPACE) c = 8;
                
                if (c == 10 || c == 8 || c == 27 || (c >= 32 && c <= 126) || (c >= 128 && c <= 133)) {
                    if (c >= 'a' && c <= 'z') c = Character.toUpperCase((char) c);
                    kbdBuffer.offer(c);
                }
            }
        });
    }

    private void setupKvmMenu() {
        JMenuBar menuBar = new JMenuBar();
        JMenu powerMenu = new JMenu("Power");
        JMenuItem btnPowerOn = new JMenuItem("Power On");
        JMenuItem btnPowerOff = new JMenuItem("Power Down");
        JMenuItem btnReboot = new JMenuItem("Reset / Reboot");
        JMenuItem btnExit = new JMenuItem("Exit KVM");

        btnPowerOn.addActionListener(e -> powerOn());
        btnPowerOff.addActionListener(e -> powerOff());
        btnReboot.addActionListener(e -> reboot());
        btnExit.addActionListener(e -> System.exit(0));

        powerMenu.add(btnPowerOn); powerMenu.add(btnPowerOff); 
        powerMenu.addSeparator(); powerMenu.add(btnReboot); 
        powerMenu.addSeparator(); powerMenu.add(btnExit);

        JMenu mediaMenu = new JMenu("Virtual Media");
        JMenuItem btnInsert = new JMenuItem("Insert CD/ISO Image...");
        JMenuItem btnEject = new JMenuItem("Eject CD-ROM");

        btnInsert.addActionListener(e -> {
            JFileChooser fc = new JFileChooser(new File("."));
            fc.setDialogTitle("Select ISO Image to Mount");
            if (fc.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
                currentIsoPath = fc.getSelectedFile().getAbsolutePath();
                diskController.loadCdromImage(currentIsoPath);
            }
        });

        btnEject.addActionListener(e -> {
            currentIsoPath = null;
            diskController.loadCdromImage(currentIsoPath);
        });

        mediaMenu.add(btnInsert); mediaMenu.add(btnEject);
        menuBar.add(powerMenu); menuBar.add(mediaMenu);
        setJMenuBar(menuBar);
    }

    public void powerOn() {
        if (poweredOn) return;
        System.out.println("[ HW ] Iron Virtual Motherboard Powering On...");
        setTitle("JavaOS Iron v14.00 [Powered On]");
        poweredOn = true;

        for(int i = 0; i < MEM_SIZE; i++) ram[i] = 0;
        this.cpu = new CPU(ram);
        kbdBuffer.clear();

        loadCmos();
        diskController.init(currentIsoPath);
        initializeVGA();
        loadDynamicOS();
        
        cpu.setPC(ROM_ADDR);
        vCpuThread = new Thread(this::runExecutionLoop, "vCPU-Thread");
        vGpuThread = new Thread(gpu::refreshLoop, "vGPU-Thread");
        vTimerThread = new Thread(this::runHardwareTimer, "vTimer-Thread");

        vCpuThread.start(); vGpuThread.start(); vTimerThread.start();
        setVisible(true);
    }

    private void powerOff() {
        if (!poweredOn) return;
        System.out.println("[ HW ] Powering Down...");
        setTitle("JavaOS Iron v14.00 [Powered Off]");
        poweredOn = false;

        networkCard.shutdown(ram);
        if (vCpuThread != null) vCpuThread.interrupt();
        if (vGpuThread != null) vGpuThread.interrupt();
        if (vTimerThread != null) vTimerThread.interrupt();
        gpu.clearScreen();
    }

    private void reboot() {
        powerOff();
        try { Thread.sleep(500); } catch (InterruptedException ignored) {}
        powerOn();
    }

    private void loadCmos() {
        try {
            byte[] data = Files.readAllBytes(Paths.get(CMOS_FILENAME));
            if (data.length > 0) { ram[CMOS_ADDR] = data[0]; lastCmos = data[0]; }
        } catch (IOException e) { ram[CMOS_ADDR] = 0; lastCmos = 0; }
    }

    private void initializeVGA() {
        for (int i = 0; i < 2000; i++) {
            ram[TEXT_ADDR + i] = (byte)0xFF; 
            ram[ATTR_ADDR + i] = 0x1F; 
        }
        for (int i = 0; i < 256; i++) {
            byte[] glyph = generateSimpleChar((char)i);
            System.arraycopy(glyph, 0, ram, FONT_ADDR + (i * 8), 8);
        }
    }

    private void loadDynamicOS() {
        Assembler as = new Assembler();
        StringBuilder osSource = new StringBuilder();
        File osDir = new File("os");
        
        if (!osDir.exists()) {
            osDir.mkdirs();
            System.err.println("[ BIOS ] 'os' directory created! Please put .asm driver files in it.");
            cpu.triggerPanic("NO_OS_FOUND");
            return;
        }

        File[] files = osDir.listFiles((dir, name) -> name.endsWith(".asm"));
        if (files == null || files.length == 0) {
            cpu.triggerPanic("NO_OS_FOUND");
            return;
        }

        Arrays.sort(files, Comparator.comparing(File::getName));
        for (File f : files) {
            try {
                osSource.append("; MODULE: ").append(f.getName()).append("\n");
                osSource.append(Files.readString(f.toPath())).append("\n");
            } catch (IOException ignored) {}
        }
        
        // FAILSAFE: Lägger alltid till avbrottshanterarna i slutet så att minnet inte hoppar till 0x0
        osSource.append("\n:tmr_isr\nIRET\n:kbd_isr\nIRET\n");

        try {
            byte[] binary = as.assemble(osSource.toString(), ROM_ADDR);
            System.arraycopy(binary, 0, ram, ROM_ADDR, binary.length);
            write24ToRam(0x00000, as.labels.getOrDefault("tmr_isr", 0)); 
            write24ToRam(0x00004, as.labels.getOrDefault("kbd_isr", 0)); 
            System.out.println("[ BIOS ] Loaded OS into ROM. Size: " + binary.length + " bytes.");
        } catch (Exception e) { System.err.println("Assembler Error: " + e.getMessage()); }
    }

    private void processKeyboardBuffer() {
        if (ram[KBD_ADDR] == 0 && !kbdBuffer.isEmpty()) {
            ram[KBD_ADDR] = (byte) (int) kbdBuffer.poll();
            cpu.triggerInterrupt(1);
        }
    }

    private void runExecutionLoop() {
        while (poweredOn) {
            if (cpu.isPanic()) { poweredOn = false; break; }
            diskController.tick(ram);
            audioCard.tick(ram);
            networkCard.tick(ram, poweredOn);
            processKeyboardBuffer();
            
            for (int i = 0; i < 3500; i++) cpu.step(); 
            try { Thread.sleep(1); } catch (InterruptedException e) { break; }
        }
    }

    private void runHardwareTimer() {
        while (poweredOn) {
            try { Thread.sleep(200); } catch (InterruptedException e) { break; }
            if (ram[CMOS_ADDR] != lastCmos) {
                try { Files.write(Paths.get(CMOS_FILENAME), new byte[]{ram[CMOS_ADDR]}); lastCmos = ram[CMOS_ADDR]; } catch (IOException ignored) {}
            }
            LocalDateTime now = LocalDateTime.now();
            ram[RTC_YEAR_HI_ADDR] = (byte) (now.getYear() >> 8);
            ram[RTC_YEAR_LO_ADDR] = (byte) (now.getYear() & 0xFF);
            ram[RTC_MONTH_ADDR]   = (byte) now.getMonthValue();
            ram[RTC_DAY_ADDR]     = (byte) now.getDayOfMonth();
            ram[RTC_HOUR_ADDR]    = (byte) now.getHour();
            ram[RTC_MIN_ADDR]     = (byte) now.getMinute();
            ram[RTC_SEC_ADDR]     = (byte) now.getSecond();
            cpu.triggerInterrupt(0);
        }
    }

    private void write24ToRam(int addr, int val) {
        ram[addr] = (byte)((val >> 16) & 0xFF); 
        ram[addr + 1] = (byte)((val >> 8) & 0xFF); 
        ram[addr + 2] = (byte)(val & 0xFF);
    }

    private byte[] generateSimpleChar(char c) {
        c = Character.toUpperCase(c);
        return switch (c) {
            case 'A' -> new byte[]{24, 36, 66, 126, 66, 66, 66, 0};
            case 'B' -> new byte[]{124, 66, 66, 124, 66, 66, 124, 0};
            case 'C' -> new byte[]{60, 66, 64, 64, 64, 66, 60, 0};
            case 'D' -> new byte[]{120, 68, 66, 66, 66, 68, 120, 0};
            case 'E' -> new byte[]{126, 64, 64, 120, 64, 64, 126, 0};
            case 'F' -> new byte[]{126, 64, 64, 120, 64, 64, 64, 0};
            case 'G' -> new byte[]{60, 66, 64, 78, 66, 66, 60, 0};
            case 'H' -> new byte[]{66, 66, 66, 126, 66, 66, 66, 0};
            case 'I' -> new byte[]{124, 16, 16, 16, 16, 16, 124, 0};
            case 'J' -> new byte[]{30, 8, 8, 8, 8, 72, 48, 0};
            case 'K' -> new byte[]{66, 68, 72, 112, 72, 68, 66, 0};
            case 'L' -> new byte[]{64, 64, 64, 64, 64, 64, 126, 0};
            case 'M' -> new byte[]{66, 102, 102, 90, 66, 66, 66, 0};
            case 'N' -> new byte[]{66, 98, 82, 74, 70, 66, 66, 0};
            case 'O' -> new byte[]{60, 66, 66, 66, 66, 66, 60, 0};
            case 'P' -> new byte[]{124, 66, 66, 124, 64, 64, 64, 0};
            case 'Q' -> new byte[]{60, 66, 66, 66, 74, 68, 58, 0};
            case 'R' -> new byte[]{124, 66, 66, 124, 72, 68, 66, 0};
            case 'S' -> new byte[]{60, 66, 60, 2, 2, 66, 60, 0};
            case 'T' -> new byte[]{126, 16, 16, 16, 16, 16, 16, 0};
            case 'U' -> new byte[]{66, 66, 66, 66, 66, 66, 60, 0};
            case 'V' -> new byte[]{66, 66, 66, 36, 36, 24, 16, 0}; 
            case 'W' -> new byte[]{66, 66, 66, 90, 102, 102, 66, 0};
            case 'X' -> new byte[]{66, 66, 36, 24, 36, 66, 66, 0};
            case 'Y' -> new byte[]{66, 66, 36, 24, 16, 16, 16, 0};
            case 'Z' -> new byte[]{126, 4, 8, 16, 32, 64, 126, 0};
            case '0' -> new byte[]{60, 66, 70, 74, 82, 66, 60, 0};
            case '1' -> new byte[]{16, 48, 16, 16, 16, 16, 124, 0};
            case '2' -> new byte[]{60, 66, 2, 60, 64, 64, 126, 0};
            case '3' -> new byte[]{126, 4, 8, 12, 2, 66, 60, 0};
            case '4' -> new byte[]{8, 24, 40, 72, 126, 8, 8, 0};
            case '5' -> new byte[]{126, 64, 124, 2, 2, 66, 60, 0};
            case '6' -> new byte[]{60, 64, 124, 66, 66, 66, 60, 0};
            case '7' -> new byte[]{126, 2, 4, 8, 16, 32, 64, 0};
            case '8' -> new byte[]{60, 66, 66, 60, 66, 66, 60, 0};
            case '9' -> new byte[]{60, 66, 66, 62, 2, 2, 60, 0};
            case '-' -> new byte[]{0, 0, 0, 62, 0, 0, 0, 0};
            case '<' -> new byte[]{8, 16, 32, 64, 32, 16, 8, 0};
            case '>' -> new byte[]{64, 32, 16, 8, 16, 32, 64, 0};
            case '|' -> new byte[]{8, 8, 8, 8, 8, 8, 8, 0};
            case ':' -> new byte[]{0, 24, 24, 0, 0, 24, 24, 0};
            case '\\' -> new byte[]{64, 32, 16, 8, 4, 2, 1, 0};
            case '.' -> new byte[]{0, 0, 0, 0, 0, 24, 24, 0};
            case '_' -> new byte[]{0, 0, 0, 0, 0, 0, 127, 0};
            case ' ' -> new byte[]{0, 0, 0, 0, 0, 0, 0, 0};
            case '?' -> new byte[]{60, 66, 2, 12, 24, 0, 24, 0};
            case '@' -> new byte[]{60, 66, 90, 82, 90, 64, 60, 0};
            case '#' -> new byte[]{20, 20, 127, 20, 127, 20, 20, 0};
            case '~' -> new byte[]{0, 0, 0, 86, 41, 0, 0, 0};
            case '/' -> new byte[]{2, 4, 8, 16, 32, 64, (byte) 128, 0};
            case '[' -> new byte[]{60, 32, 32, 32, 32, 32, 60, 0};
            case ']' -> new byte[]{60, 4, 4, 4, 4, 4, 60, 0};
            default -> new byte[]{0, 0, 0, 0, 0, 0, 0, 0};
        };
    }

    public static void main(String[] args) { new Machine().powerOn(); }
}