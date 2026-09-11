import { AudioCard } from "./AudioCard";
import { CPU } from "./CPU";
import { DiskController } from "./DiskController";
import { NetworkCard } from "./NetworkCard";
import { Assembler } from "./Assembler";
import {
  MEM_SIZE, KBD_ADDR, TEXT_ADDR, ATTR_ADDR, FONT_ADDR, ROM_ADDR,
  CMOS_ADDR, RTC_YEAR_HI_ADDR, RTC_YEAR_LO_ADDR,
  RTC_MONTH_ADDR, RTC_DAY_ADDR, RTC_HOUR_ADDR, RTC_MIN_ADDR, RTC_SEC_ADDR,
  MOUSE_X_ADDR, MOUSE_Y_ADDR, MOUSE_BTN_ADDR
} from "./constants";

export class Machine {
  public ram = new Uint8Array(MEM_SIZE);
  public cpu: CPU;
  public diskController = new DiskController();
  public networkCard = new NetworkCard();
  public audioCard = new AudioCard();
  
  public poweredOn = false;
  private lastCmos = 0;

  private kbdBuffer: number[] = [];
  
  private runnerId: number | null = null;
  private timerId: number | null = null;

  constructor() {
    this.cpu = new CPU(this.ram);
  }

  public async powerOn(osFiles: Record<string, string>) {
    if (this.poweredOn) return;
    this.poweredOn = true;

    this.ram.fill(0);
    this.cpu = new CPU(this.ram);
    this.kbdBuffer = [];

    this.loadCmos();
    this.diskController.init();
    this.initializeVGA();
    this.loadDynamicOS(osFiles);

    this.cpu.setPC(ROM_ADDR);

    this.runExecutionLoop();
    this.runHardwareTimer();
  }

  public powerOff() {
    if (!this.poweredOn) return;
    this.poweredOn = false;
    this.networkCard.shutdown(this.ram);

    if (this.runnerId !== null) {
      clearTimeout(this.runnerId);
      this.runnerId = null;
    }
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Clear screen
    for (let i = 0; i < 2000; i++) {
      this.ram[TEXT_ADDR + i] = 0;
      this.ram[ATTR_ADDR + i] = 0;
    }
  }

  public reboot(osFiles: Record<string, string>) {
    this.powerOff();
    setTimeout(() => this.powerOn(osFiles), 500);
  }

  public handleKeyPress(keyCode: number, keyChar: string, isCtrl: boolean) {
    if (!this.poweredOn || this.cpu.isPanic()) return;

    let c = keyChar.charCodeAt(0);
    
    if (isCtrl) {
      if (c === 115 || c === 83) c = 132; // Ctrl+S
      else if (c === 120 || c === 88) c = 133; // Ctrl+X
    } else if (keyCode === 37) c = 128; // Left
    else if (keyCode === 39) c = 129; // Right
    else if (keyCode === 38) c = 130; // Up
    else if (keyCode === 40) c = 131; // Down
    else if (keyCode === 27) c = 27;  // Esc
    else if (keyCode === 13) c = 10;  // Enter
    else if (keyCode === 8) c = 8;    // Backspace

    if (c === 10 || c === 8 || c === 27 || (c >= 32 && c <= 126) || (c >= 128 && c <= 133)) {
      if (c >= 97 && c <= 122) c -= 32; // Uppercase
      this.kbdBuffer.push(c);
    }
  }

  public handleMouseEvent(x: number, y: number, btn: number, isMoveOnly: boolean) {
    if (!this.poweredOn || this.cpu.isPanic()) return;
    this.ram[MOUSE_X_ADDR] = (x >> 8) & 0xFF;
    this.ram[MOUSE_X_ADDR + 1] = x & 0xFF;
    this.ram[MOUSE_Y_ADDR] = (y >> 8) & 0xFF;
    this.ram[MOUSE_Y_ADDR + 1] = y & 0xFF;
    
    if (!isMoveOnly) {
      this.ram[MOUSE_BTN_ADDR] = btn;
      this.cpu.triggerInterrupt(2);
    }
  }

  private loadCmos() {
    const cmos = localStorage.getItem("iron_cmos");
    if (cmos) {
      this.ram[CMOS_ADDR] = parseInt(cmos, 10);
      this.lastCmos = this.ram[CMOS_ADDR];
    }
  }

  private initializeVGA() {
    for (let i = 0; i < 2000; i++) {
      this.ram[TEXT_ADDR + i] = 0xFF;
      this.ram[ATTR_ADDR + i] = 0x1F;
    }
    for (let i = 0; i < 256; i++) {
      const glyph = this.generateSimpleChar(String.fromCharCode(i));
      this.ram.set(glyph, FONT_ADDR + (i * 8));
    }
  }

  private loadDynamicOS(osFiles: Record<string, string>) {
    const as = new Assembler();
    let osSource = "";
    
    const fileNames = Object.keys(osFiles).sort();
    for (const f of fileNames) {
      osSource += `; MODULE: ${f}\n${osFiles[f]}\n`;
    }

    osSource += "\n:tmr_isr\nIRET\n:kbd_isr\nIRET\n:mouse_isr\nIRET\n";

    try {
      const binary = as.assemble(osSource, ROM_ADDR);
      this.ram.set(binary, ROM_ADDR);
      
      const tmr = as.labels.get("tmr_isr") || 0;
      const kbd = as.labels.get("kbd_isr") || 0;
      const mse = as.labels.get("mouse_isr") || 0;
      this.write24ToRam(0x00000, tmr);
      this.write24ToRam(0x00004, kbd);
      this.write24ToRam(0x00008, mse); // IRQ 2
      
      console.log(`[ BIOS ] Loaded OS into ROM. Size: ${binary.length} bytes.`);
    } catch (e) {
      console.error("Assembler Error: " + e);
    }
  }

  private processKeyboardBuffer() {
    if (this.ram[KBD_ADDR] === 0 && this.kbdBuffer.length > 0) {
      this.ram[KBD_ADDR] = this.kbdBuffer.shift()!;
      this.cpu.triggerInterrupt(1);
    }
  }

  private runExecutionLoop = () => {
    if (!this.poweredOn) return;
    if (this.cpu.isPanic()) {
      this.poweredOn = false;
      return;
    }

    this.diskController.tick(this.ram);
    this.audioCard.tick(this.ram);
    this.networkCard.tick(this.ram);
    this.processKeyboardBuffer();

    for (let i = 0; i < 5000; i++) {
      if (this.cpu.isPanic()) break;
      this.cpu.step();
    }

    this.runnerId = setTimeout(this.runExecutionLoop, 0) as unknown as number;
  }

  private runHardwareTimer = () => {
    if (!this.poweredOn) return;

    if (this.ram[CMOS_ADDR] !== this.lastCmos) {
      this.lastCmos = this.ram[CMOS_ADDR];
      localStorage.setItem("iron_cmos", this.lastCmos.toString());
    }

    const now = new Date();
    const year = now.getFullYear();
    this.ram[RTC_YEAR_HI_ADDR] = (year >> 8) & 0xFF;
    this.ram[RTC_YEAR_LO_ADDR] = year & 0xFF;
    this.ram[RTC_MONTH_ADDR] = now.getMonth() + 1;
    this.ram[RTC_DAY_ADDR] = now.getDate();
    this.ram[RTC_HOUR_ADDR] = now.getHours();
    this.ram[RTC_MIN_ADDR] = now.getMinutes();
    this.ram[RTC_SEC_ADDR] = now.getSeconds();

    this.cpu.triggerInterrupt(0);

    this.timerId = setTimeout(this.runHardwareTimer, 200) as unknown as number;
  }

  private write24ToRam(addr: number, val: number) {
    this.ram[addr] = (val >> 16) & 0xFF;
    this.ram[addr + 1] = (val >> 8) & 0xFF;
    this.ram[addr + 2] = val & 0xFF;
  }

  private generateSimpleChar(char: string): Uint8Array {
    let c = char.toUpperCase();
    let arr: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    switch (c) {
      case 'A': arr = [24, 36, 66, 126, 66, 66, 66, 0]; break;
      case 'B': arr = [124, 66, 66, 124, 66, 66, 124, 0]; break;
      case 'C': arr = [60, 66, 64, 64, 64, 66, 60, 0]; break;
      case 'D': arr = [120, 68, 66, 66, 66, 68, 120, 0]; break;
      case 'E': arr = [126, 64, 64, 120, 64, 64, 126, 0]; break;
      case 'F': arr = [126, 64, 64, 120, 64, 64, 64, 0]; break;
      case 'G': arr = [60, 66, 64, 78, 66, 66, 60, 0]; break;
      case 'H': arr = [66, 66, 66, 126, 66, 66, 66, 0]; break;
      case 'I': arr = [124, 16, 16, 16, 16, 16, 124, 0]; break;
      case 'J': arr = [30, 8, 8, 8, 8, 72, 48, 0]; break;
      case 'K': arr = [66, 68, 72, 112, 72, 68, 66, 0]; break;
      case 'L': arr = [64, 64, 64, 64, 64, 64, 126, 0]; break;
      case 'M': arr = [66, 102, 102, 90, 66, 66, 66, 0]; break;
      case 'N': arr = [66, 98, 82, 74, 70, 66, 66, 0]; break;
      case 'O': arr = [60, 66, 66, 66, 66, 66, 60, 0]; break;
      case 'P': arr = [124, 66, 66, 124, 64, 64, 64, 0]; break;
      case 'Q': arr = [60, 66, 66, 66, 74, 68, 58, 0]; break;
      case 'R': arr = [124, 66, 66, 124, 72, 68, 66, 0]; break;
      case 'S': arr = [60, 66, 60, 2, 2, 66, 60, 0]; break;
      case 'T': arr = [126, 16, 16, 16, 16, 16, 16, 0]; break;
      case 'U': arr = [66, 66, 66, 66, 66, 66, 60, 0]; break;
      case 'V': arr = [66, 66, 66, 36, 36, 24, 16, 0]; break;
      case 'W': arr = [66, 66, 66, 90, 102, 102, 66, 0]; break;
      case 'X': arr = [66, 66, 36, 24, 36, 66, 66, 0]; break;
      case 'Y': arr = [66, 66, 36, 24, 16, 16, 16, 0]; break;
      case 'Z': arr = [126, 4, 8, 16, 32, 64, 126, 0]; break;
      case '0': arr = [60, 66, 70, 74, 82, 66, 60, 0]; break;
      case '1': arr = [16, 48, 16, 16, 16, 16, 124, 0]; break;
      case '2': arr = [60, 66, 2, 60, 64, 64, 126, 0]; break;
      case '3': arr = [126, 4, 8, 12, 2, 66, 60, 0]; break;
      case '4': arr = [8, 24, 40, 72, 126, 8, 8, 0]; break;
      case '5': arr = [126, 64, 124, 2, 2, 66, 60, 0]; break;
      case '6': arr = [60, 64, 124, 66, 66, 66, 60, 0]; break;
      case '7': arr = [126, 2, 4, 8, 16, 32, 64, 0]; break;
      case '8': arr = [60, 66, 66, 60, 66, 66, 60, 0]; break;
      case '9': arr = [60, 66, 66, 62, 2, 2, 60, 0]; break;
      case '-': arr = [0, 0, 0, 62, 0, 0, 0, 0]; break;
      case '<': arr = [8, 16, 32, 64, 32, 16, 8, 0]; break;
      case '>': arr = [64, 32, 16, 8, 16, 32, 64, 0]; break;
      case '|': arr = [8, 8, 8, 8, 8, 8, 8, 0]; break;
      case ':': arr = [0, 24, 24, 0, 0, 24, 24, 0]; break;
      case '\\': arr = [64, 32, 16, 8, 4, 2, 1, 0]; break;
      case '.': arr = [0, 0, 0, 0, 0, 24, 24, 0]; break;
      case ',': arr = [0, 0, 0, 0, 0, 24, 24, 48]; break;
      case '/': arr = [2, 4, 8, 16, 32, 64, 128, 0]; break;
      case '(': arr = [8, 16, 32, 32, 32, 16, 8, 0]; break;
      case ')': arr = [32, 16, 8, 8, 8, 16, 32, 0]; break;
      case '\'': arr = [24, 24, 8, 0, 0, 0, 0, 0]; break;
      case '[': arr = [30, 16, 16, 16, 16, 16, 30, 0]; break;
      case ']': arr = [60, 4, 4, 4, 4, 4, 60, 0]; break;
      case '=': arr = [0, 0, 126, 0, 126, 0, 0, 0]; break;
      case '_': arr = [0, 0, 0, 0, 0, 0, 127, 0]; break;
      case ' ': arr = [0, 0, 0, 0, 0, 0, 0, 0]; break;
      case '?': arr = [60, 66, 2, 12, 24, 0, 24, 0]; break;
      case '@': arr = [60, 66, 90, 82, 90, 64, 60, 0]; break;
      case '#': arr = [20, 20, 127, 20, 127, 20, 20, 0]; break;
      case '~': arr = [0, 0, 0, 86, 41, 0, 0, 0]; break;
      case '/': arr = [2, 4, 8, 16, 32, 64, 128, 0]; break;
      case '[': arr = [60, 32, 32, 32, 32, 32, 60, 0]; break;
      case ']': arr = [60, 4, 4, 4, 4, 4, 60, 0]; break;
      default: arr = [0, 0, 0, 0, 0, 0, 0, 0]; break;
    }
    return new Uint8Array(arr);
  }
}
