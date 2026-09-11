import { Assembler } from "./Assembler";

export const DISK_SECTOR_ADDR = 0xA0020;
export const DISK_BUFFER_ADDR = 0xA0024;
export const DISK_CMD_ADDR = 0xA0028;
export const ACTIVE_DRIVE_ADDR = 0xA002C;
export const SECTOR_SIZE = 512;
export const DISK_SIZE = 1024 * 1024;

export class DiskController {
  private disk = new Uint8Array(DISK_SIZE);
  private cdrom = new Uint8Array(DISK_SIZE);

  public init() {
    this.loadDiskImage();
    this.loadCdromImage();
  }

  private loadDiskImage() {
    const saved = localStorage.getItem("iron_disk_img");
    if (saved) {
      try {
        const decoded = atob(saved);
        for (let i = 0; i < decoded.length && i < DISK_SIZE; i++) {
          this.disk[i] = decoded.charCodeAt(i);
        }
        if (this.findFileSector(this.disk, "APP") === -1) {
          this.addFileEntryToDisk(this.disk, "APP", 1);
          this.patchAppAtSector(1);
          this.saveDiskToHost();
        }
      } catch (e) {
        console.error("Failed to load disk image from local storage", e);
      }
    } else {
      this.disk.fill(0);
      this.addFileEntryToDisk(this.disk, "APP", 1);
      this.patchAppAtSector(1);
      this.saveDiskToHost();
    }
  }

  public loadCdromImage() {
    this.cdrom.fill(0);
    this.addFileEntryToDisk(this.cdrom, "README", 1);
    this.addFileEntryToDisk(this.cdrom, "MANUAL", 2);
    
    const readme = "WELCOME TO THE IRON-NIX RECOVERY CD!\nTHIS DRIVE IS COMPLETELY READ-ONLY.\nTRY TO 'CAT MANUAL'.\n\0";
    for (let i = 0; i < readme.length; i++) this.cdrom[SECTOR_SIZE * 1 + i] = readme.charCodeAt(i);
    
    const manual = "--- RECOVERY MANUAL ---\n1. BOOT FROM CD (CHANGE IN BIOS SETUP)\n2. TRY CONNECTING TO MULTIPLE VMS VIA 'HOST' & 'JOIN'\n\0";
    for (let i = 0; i < manual.length; i++) this.cdrom[SECTOR_SIZE * 2 + i] = manual.charCodeAt(i);
  }

  public tick(ram: Uint8Array) {
    const cmd = ram[DISK_CMD_ADDR] & 0xFF;
    if (cmd === 0) return;

    const drive = ram[ACTIVE_DRIVE_ADDR] & 0xFF;
    const activeDisk = drive === 1 ? this.cdrom : this.disk;
    const isReadOnly = drive === 1;

    const param1 = ((ram[DISK_SECTOR_ADDR] & 0xFF) << 16) | ((ram[DISK_SECTOR_ADDR+1] & 0xFF) << 8) | (ram[DISK_SECTOR_ADDR+2] & 0xFF);
    const bufferAddr = ((ram[DISK_BUFFER_ADDR] & 0xFF) << 16) | ((ram[DISK_BUFFER_ADDR+1] & 0xFF) << 8) | (ram[DISK_BUFFER_ADDR+2] & 0xFF);

    if (cmd === 1 || cmd === 2) {
      if (cmd === 2 && isReadOnly) { ram[DISK_CMD_ADDR] = 0xFE; return; }
      const diskOffset = param1 * SECTOR_SIZE;
      if (diskOffset < activeDisk.length && bufferAddr + SECTOR_SIZE <= ram.length) {
        if (cmd === 1) {
          ram.set(activeDisk.subarray(diskOffset, diskOffset + SECTOR_SIZE), bufferAddr);
        } else {
          activeDisk.set(ram.subarray(bufferAddr, bufferAddr + SECTOR_SIZE), diskOffset);
          this.saveDiskToHost();
        }
      }
      ram[DISK_CMD_ADDR] = 0;
    } else if (cmd === 3) {
      const filename = this.readStringFromRam(ram, param1).trim().toUpperCase();
      const sector = this.findFileSector(activeDisk, filename);
      if (sector > 0 && bufferAddr + SECTOR_SIZE <= ram.length) {
        ram.set(activeDisk.subarray(sector * SECTOR_SIZE, (sector + 1) * SECTOR_SIZE), bufferAddr);
        ram[DISK_CMD_ADDR] = 0;
      } else {
        if (bufferAddr >= 0 && bufferAddr < ram.length) ram[bufferAddr] = 0;
        ram[DISK_CMD_ADDR] = 0xFF;
      }
    } else if (cmd === 4) {
      if (isReadOnly) { ram[DISK_CMD_ADDR] = 0xFE; return; }
      let filename = this.readStringFromRam(ram, param1).trim().toUpperCase();
      if (!filename) filename = "UNNAMED";
      let sector = this.findFileSector(activeDisk, filename);
      if (sector <= 0) {
        sector = this.allocateFreeSector(activeDisk);
        if (sector > 0) this.addFileEntryToDisk(activeDisk, filename, sector);
      }
      if (sector > 0 && bufferAddr + SECTOR_SIZE <= ram.length) {
        activeDisk.set(ram.subarray(bufferAddr, bufferAddr + SECTOR_SIZE), sector * SECTOR_SIZE);
        this.saveDiskToHost();
        ram[DISK_CMD_ADDR] = 0;
      } else {
        ram[DISK_CMD_ADDR] = 0xFF;
      }
    } else if (cmd === 5) {
      const dirListing = this.generateDirectoryListing(activeDisk);
      if (bufferAddr + dirListing.length < ram.length) {
        for (let i = 0; i < dirListing.length; i++) {
          ram[bufferAddr + i] = dirListing.charCodeAt(i);
        }
        ram[bufferAddr + dirListing.length] = 0;
      }
      ram[DISK_CMD_ADDR] = 0;
    } else if (cmd === 6) {
      if (isReadOnly) { ram[DISK_CMD_ADDR] = 0xFE; return; }
      const filename = this.readStringFromRam(ram, param1).trim().toUpperCase();
      let deleted = false;
      for (let i = 0; i < SECTOR_SIZE; i += 16) {
        if (activeDisk[i] !== 0 && this.readDiskString(activeDisk, i) === filename) {
          activeDisk[i] = 0;
          deleted = true;
          break;
        }
      }
      if (deleted) {
        this.saveDiskToHost();
        ram[DISK_CMD_ADDR] = 0;
      } else {
        ram[DISK_CMD_ADDR] = 0xFF;
      }
    }
  }

  private patchAppAtSector(sector: number) {
    const appAs = new Assembler();
    const appSrc = "MOV R4, str_hello\nMOV R0, 1\nINT 0x21\nRET\n:str_hello\nDB \"*** HELLO FROM EXTERNAL APP ***\"\nDB 10, 0\n";
    try {
      const appBin = appAs.assemble(appSrc, 0x40000);
      this.disk.set(appBin, SECTOR_SIZE * sector);
    } catch (e) { console.warn(e); }
  }

  private saveDiskToHost() {
    try {
      let binary = "";
      for (let i = 0; i < this.disk.length; i++) {
        binary += String.fromCharCode(this.disk[i]);
      }
      localStorage.setItem("iron_disk_img", btoa(binary));
    } catch (e) { console.warn(e); }
  }

  private addFileEntryToDisk(targetDisk: Uint8Array, filename: string, sector: number) {
    for (let i = 0; i < SECTOR_SIZE; i += 16) {
      if (targetDisk[i] === 0 || this.readDiskString(targetDisk, i) === filename) {
        for (let j = 0; j < 12; j++) {
          targetDisk[i+j] = j < filename.length ? filename.charCodeAt(j) : 0;
        }
        targetDisk[i+12] = (sector >> 8) & 0xFF;
        targetDisk[i+13] = sector & 0xFF;
        targetDisk[i+14] = 0;
        targetDisk[i+15] = 1;
        return;
      }
    }
  }

  private findFileSector(targetDisk: Uint8Array, filename: string): number {
    for (let i = 0; i < SECTOR_SIZE; i += 16) {
      if (targetDisk[i] === 0) continue;
      if (this.readDiskString(targetDisk, i) === filename) {
        return ((targetDisk[i+12] & 0xFF) << 8) | (targetDisk[i+13] & 0xFF);
      }
    }
    return -1;
  }

  private allocateFreeSector(targetDisk: Uint8Array): number {
    let maxSector = 0;
    for (let i = 0; i < SECTOR_SIZE; i += 16) {
      if (targetDisk[i] !== 0) {
        const sec = ((targetDisk[i+12] & 0xFF) << 8) | (targetDisk[i+13] & 0xFF);
        if (sec > maxSector) maxSector = sec;
      }
    }
    return maxSector === 0 ? 1 : maxSector + 1;
  }

  private readDiskString(targetDisk: Uint8Array, addr: number): string {
    let str = "";
    for (let j = 0; j < 12 && targetDisk[addr+j] !== 0; j++) {
      str += String.fromCharCode(targetDisk[addr+j]);
    }
    return str.trim();
  }

  private readStringFromRam(ram: Uint8Array, addr: number): string {
    let str = "";
    while (addr < ram.length && ram[addr] !== 0 && str.length < 50) {
      str += String.fromCharCode(ram[addr]);
      addr++;
    }
    return str;
  }

  private generateDirectoryListing(targetDisk: Uint8Array): string {
    let list = "";
    let count = 0;
    for (let i = 0; i < SECTOR_SIZE; i += 16) {
      if (targetDisk[i] === 0) continue;
      list += `-RW-R--R-- 1 ROOT ROOT 512 ${this.readDiskString(targetDisk, i)}\n`;
      count++;
    }
    return `TOTAL FILES: ${count}\n` + list;
  }
}
