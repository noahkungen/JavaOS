package com.javaos.hardware;

import java.io.*;
import java.nio.file.*;

public class DiskController {
    public static final int DISK_SECTOR_ADDR = 0xA0020; 
    public static final int DISK_BUFFER_ADDR = 0xA0024; 
    public static final int DISK_CMD_ADDR = 0xA0028;    
    public static final int ACTIVE_DRIVE_ADDR = 0xA002C; 
    public static final int SECTOR_SIZE = 512;
    public static final int DISK_SIZE = 1024 * 1024; 

    private final String DISK_FILENAME = "iron_disk.img";
    private final String CDROM_FILENAME = "iron_recovery_cd.iso";
    private final byte[] disk = new byte[DISK_SIZE]; 
    private final byte[] cdrom = new byte[DISK_SIZE]; 

    public void init(String currentIsoPath) {
        loadDiskImage();
        loadCdromImage(currentIsoPath);
    }

    private void loadDiskImage() {
        Path path = Paths.get(DISK_FILENAME);
        if (Files.exists(path)) {
            try {
                byte[] data = Files.readAllBytes(path);
                System.arraycopy(data, 0, disk, 0, Math.min(data.length, DISK_SIZE));
                if (findFileSector(disk, "APP") == -1) {
                    addFileEntryToDisk(disk, "APP", 1);
                    patchAppAtSector(1);
                    saveDiskToHost();
                }
            } catch (IOException ignored) {}
        } else {
            for (int i = 0; i < DISK_SIZE; i++) disk[i] = 0;
            addFileEntryToDisk(disk, "APP", 1);
            patchAppAtSector(1);
            saveDiskToHost();
        }
    }

    public void loadCdromImage(String currentIsoPath) {
        for (int i = 0; i < DISK_SIZE; i++) cdrom[i] = 0;
        if (currentIsoPath == null) return; 

        Path path = Paths.get(currentIsoPath);
        if (Files.exists(path)) {
            try {
                byte[] data = Files.readAllBytes(path);
                System.arraycopy(data, 0, cdrom, 0, Math.min(data.length, DISK_SIZE));
            } catch (IOException ignored) {}
        } else if (currentIsoPath.equals(CDROM_FILENAME)) {
            addFileEntryToDisk(cdrom, "README", 1);
            addFileEntryToDisk(cdrom, "MANUAL", 2);
            
            String readme = "WELCOME TO THE IRON-NIX RECOVERY CD!\nTHIS DRIVE IS COMPLETELY READ-ONLY.\nTRY TO 'CAT MANUAL'.\n\0";
            System.arraycopy(readme.getBytes(), 0, cdrom, SECTOR_SIZE * 1, readme.getBytes().length);
            
            String manual = "--- RECOVERY MANUAL ---\n1. BOOT FROM CD (CHANGE IN BIOS SETUP)\n2. TRY CONNECTING TO MULTIPLE VMS VIA 'HOST' & 'JOIN'\n\0";
            System.arraycopy(manual.getBytes(), 0, cdrom, SECTOR_SIZE * 2, manual.getBytes().length);

            try (FileOutputStream fos = new FileOutputStream(CDROM_FILENAME)) {
                fos.write(cdrom);
            } catch (IOException ignored) {}
        }
    }

    public void tick(byte[] ram) {
        int cmd = ram[DISK_CMD_ADDR] & 0xFF;
        if (cmd == 0) return;
        
        int drive = ram[ACTIVE_DRIVE_ADDR] & 0xFF;
        byte[] activeDisk = (drive == 1) ? cdrom : disk;
        boolean isReadOnly = (drive == 1);

        int param1 = ((ram[DISK_SECTOR_ADDR] & 0xFF) << 16) | ((ram[DISK_SECTOR_ADDR+1] & 0xFF) << 8) | (ram[DISK_SECTOR_ADDR+2] & 0xFF);
        int bufferAddr = ((ram[DISK_BUFFER_ADDR] & 0xFF) << 16) | ((ram[DISK_BUFFER_ADDR+1] & 0xFF) << 8) | (ram[DISK_BUFFER_ADDR+2] & 0xFF);

        if (cmd == 1 || cmd == 2) { 
            if (cmd == 2 && isReadOnly) { ram[DISK_CMD_ADDR] = (byte)0xFE; return; }
            int diskOffset = param1 * SECTOR_SIZE;
            if (diskOffset < activeDisk.length && bufferAddr + SECTOR_SIZE < ram.length) {
                if (cmd == 1) System.arraycopy(activeDisk, diskOffset, ram, bufferAddr, SECTOR_SIZE);
                else {
                    System.arraycopy(ram, bufferAddr, activeDisk, diskOffset, SECTOR_SIZE);
                    saveDiskToHost();
                }
            }
            ram[DISK_CMD_ADDR] = 0;
        } 
        else if (cmd == 3) { 
            String filename = readStringFromRam(ram, param1).trim().toUpperCase();
            int sector = findFileSector(activeDisk, filename);
            if (sector > 0 && bufferAddr + SECTOR_SIZE < ram.length) {
                System.arraycopy(activeDisk, sector * SECTOR_SIZE, ram, bufferAddr, SECTOR_SIZE);
                ram[DISK_CMD_ADDR] = 0; 
            } else {
                if (bufferAddr >= 0 && bufferAddr < ram.length) ram[bufferAddr] = 0;
                ram[DISK_CMD_ADDR] = (byte)0xFF; 
            }
        } 
        else if (cmd == 4) { 
            if (isReadOnly) { ram[DISK_CMD_ADDR] = (byte)0xFE; return; }
            String filename = readStringFromRam(ram, param1).trim().toUpperCase();
            if (filename.isEmpty()) filename = "UNNAMED";
            int sector = findFileSector(activeDisk, filename);
            if (sector <= 0) {
                sector = allocateFreeSector(activeDisk);
                if (sector > 0) addFileEntryToDisk(activeDisk, filename, sector);
            }
            if (sector > 0 && bufferAddr + SECTOR_SIZE < ram.length) {
                System.arraycopy(ram, bufferAddr, activeDisk, sector * SECTOR_SIZE, SECTOR_SIZE);
                saveDiskToHost();
                ram[DISK_CMD_ADDR] = 0;
            } else {
                ram[DISK_CMD_ADDR] = (byte)0xFF; 
            }
        } 
        else if (cmd == 5) { 
            String dirListing = generateDirectoryListing(activeDisk);
            byte[] bytes = dirListing.getBytes();
            if (bufferAddr + bytes.length < ram.length) {
                System.arraycopy(bytes, 0, ram, bufferAddr, bytes.length);
                ram[bufferAddr + bytes.length] = 0; 
            }
            ram[DISK_CMD_ADDR] = 0;
        }
        else if (cmd == 6) { 
            if (isReadOnly) { ram[DISK_CMD_ADDR] = (byte)0xFE; return; }
            String filename = readStringFromRam(ram, param1).trim().toUpperCase();
            boolean deleted = false;
            for (int i = 0; i < SECTOR_SIZE; i += 16) {
                if (activeDisk[i] != 0 && readDiskString(activeDisk, i).equals(filename)) {
                    activeDisk[i] = 0; 
                    deleted = true;
                    break;
                }
            }
            if (deleted) {
                saveDiskToHost();
                ram[DISK_CMD_ADDR] = 0;
            } else {
                ram[DISK_CMD_ADDR] = (byte)0xFF;
            }
        }
    }

    private void patchAppAtSector(int sector) {
        Assembler appAs = new Assembler();
        String appSrc = "MOV R4, str_hello\n" + "MOV R0, 1\n" + "INT 0x21\n" + "RET\n" + ":str_hello\n" + "DB \"*** HELLO FROM EXTERNAL APP ***\"\n" + "DB 10, 0\n";
        try { byte[] appBin = appAs.assemble(appSrc, 0x40000); System.arraycopy(appBin, 0, disk, SECTOR_SIZE * sector, appBin.length); } catch(Exception ignored) {}
    }

    private void saveDiskToHost() {
        try (FileOutputStream fos = new FileOutputStream(DISK_FILENAME)) { fos.write(disk); } catch (IOException ignored) {}
    }

    private void addFileEntryToDisk(byte[] targetDisk, String filename, int sector) {
        for (int i = 0; i < SECTOR_SIZE; i += 16) {
            if (targetDisk[i] == 0 || readDiskString(targetDisk, i).equals(filename)) {
                for (int j = 0; j < 12; j++) targetDisk[i+j] = (byte)(j < filename.length() ? filename.charAt(j) : 0);
                targetDisk[i+12] = (byte)(sector >> 8);
                targetDisk[i+13] = (byte)(sector & 0xFF);
                targetDisk[i+14] = 0;
                targetDisk[i+15] = 1; 
                return;
            }
        }
    }

    private int findFileSector(byte[] targetDisk, String filename) {
        for (int i = 0; i < SECTOR_SIZE; i += 16) {
            if (targetDisk[i] == 0) continue; 
            if (readDiskString(targetDisk, i).equals(filename)) return ((targetDisk[i+12] & 0xFF) << 8) | (targetDisk[i+13] & 0xFF);
        }
        return -1;
    }

    private int allocateFreeSector(byte[] targetDisk) {
        int maxSector = 0;
        for (int i = 0; i < SECTOR_SIZE; i += 16) {
            if (targetDisk[i] != 0) {
                int sec = ((targetDisk[i+12] & 0xFF) << 8) | (targetDisk[i+13] & 0xFF);
                if (sec > maxSector) maxSector = sec;
            }
        }
        return maxSector == 0 ? 1 : maxSector + 1;
    }

    private String readDiskString(byte[] targetDisk, int addr) {
        StringBuilder sb = new StringBuilder();
        for (int j = 0; j < 12 && targetDisk[addr+j] != 0; j++) sb.append((char)(targetDisk[addr+j] & 0xFF));
        return sb.toString().trim();
    }

    private String readStringFromRam(byte[] ram, int addr) {
        StringBuilder sb = new StringBuilder();
        while (addr < ram.length && ram[addr] != 0 && sb.length() < 50) {
            sb.append((char)(ram[addr] & 0xFF));
            addr++;
        }
        return sb.toString();
    }

    private String generateDirectoryListing(byte[] targetDisk) {
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (int i = 0; i < SECTOR_SIZE; i += 16) {
            if (targetDisk[i] == 0) continue;
            sb.append(String.format("-RW-R--R-- 1 ROOT ROOT 512 %s\n", readDiskString(targetDisk, i)));
            count++;
        }
        sb.insert(0, String.format("TOTAL FILES: %d\n", count));
        return sb.toString();
    }
}