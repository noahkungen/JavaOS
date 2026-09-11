import { IVT_START } from "./constants";

export class CPU {
  private memory: Uint8Array;
  public registers = new Uint32Array(8);
  private pc = 0;
  private sp = 0x9FFFF;
  private zeroFlag = false;
  private signFlag = false;
  private interruptsEnabled = false;
  private halt = false;
  private panic = false;
  private panicCode = "";
  
  private pendingInterrupt = -1;

  constructor(memory: Uint8Array) {
    this.memory = memory;
  }

  public setPC(addr: number) { this.pc = addr; }
  public isPanic() { return this.panic; }
  public getPanicCode() { return this.panicCode; }
  public getPC() { return this.pc; }
  
  public triggerInterrupt(irq: number) {
    if (this.interruptsEnabled) this.pendingInterrupt = irq;
  }

  public step() {
    if (this.panic || this.halt) return;

    if (this.pendingInterrupt !== -1) {
      this.executeInterrupt(this.pendingInterrupt);
      this.pendingInterrupt = -1;
    }

    const opcode = this.fetch8();

    switch (opcode) {
      case 0x00: this.halt = true; break;
      case 0x01: this.registers[this.fetch8() & 0x07] = this.fetch24(); break;
      case 0x02: this.registers[this.fetch8() & 0x07] = this.read24(this.fetch24()); break;
      case 0x03: this.write24(this.fetch24(), this.registers[this.fetch8() & 0x07]); break;
      case 0x04: {
        const addA = this.fetch8() & 0x07;
        this.registers[addA] = (this.registers[addA] + this.registers[this.fetch8() & 0x07]) & 0xFFFFFF;
        this.updateFlags(this.registers[addA]);
        break;
      }
      case 0x05: this.pc = this.fetch24(); break;
      case 0x06: {
        const jzTarget = this.fetch24();
        if (this.zeroFlag) this.pc = jzTarget;
        break;
      }
      case 0x07: this.push32(this.registers[this.fetch8() & 0x07]); break;
      case 0x08: this.registers[this.fetch8() & 0x07] = this.pop32(); break;
      case 0x09: {
        const callTarget = this.fetch24();
        this.push32(this.pc);
        this.pc = callTarget;
        break;
      }
      case 0x0A: this.pc = this.pop32(); break;
      case 0x0B: this.registers[this.fetch8() & 0x07] = this.read8(this.fetch24()); break;
      case 0x0C: {
        const subA = this.fetch8() & 0x07;
        this.registers[subA] = (this.registers[subA] - this.registers[this.fetch8() & 0x07]) & 0xFFFFFF;
        this.updateFlags(this.registers[subA]);
        break;
      }
      case 0x0F: {
        const valA = this.registers[this.fetch8() & 0x07];
        const valB = this.registers[this.fetch8() & 0x07];
        this.updateFlags(valA - valB);
        break;
      }
      case 0x10: {
        const jneTarget = this.fetch24();
        if (!this.zeroFlag) this.pc = jneTarget;
        break;
      }
      case 0x12: {
        const lIndDest = this.fetch8() & 0x07;
        this.registers[lIndDest] = this.read8(this.registers[this.fetch8() & 0x07] & 0xFFFFF);
        break;
      }
      case 0x13: {
        const sIndPtr = this.registers[this.fetch8() & 0x07] & 0xFFFFF;
        const sIndVal = this.registers[this.fetch8() & 0x07] & 0xFF;
        this.write8(sIndPtr, sIndVal);
        break;
      }
      case 0x14: this.interruptsEnabled = false; break;
      case 0x15: this.interruptsEnabled = true; break;
      case 0x16: {
        this.pc = this.pop32();
        const packed = this.pop32();
        this.zeroFlag = (packed & 1) !== 0;
        this.signFlag = (packed & 2) !== 0;
        this.interruptsEnabled = (packed & 4) !== 0;
        break;
      }
      case 0x19: {
        const mRA = this.fetch8() & 0x07;
        this.registers[mRA] = (this.registers[mRA] * this.registers[this.fetch8() & 0x07]) & 0xFFFFFF;
        this.updateFlags(this.registers[mRA]);
        break;
      }
      case 0x1A: {
        const s8Addr = this.fetch24();
        this.write8(s8Addr, this.registers[this.fetch8() & 0x07] & 0xFF);
        break;
      }
      case 0x1B: {
        const destReg = this.fetch8() & 0x07;
        this.registers[destReg] = this.registers[this.fetch8() & 0x07];
        break;
      }
      case 0x20: {
        const incReg = this.fetch8() & 0x07;
        this.registers[incReg] = (this.registers[incReg] + 1) & 0xFFFFFF;
        this.updateFlags(this.registers[incReg]);
        break;
      }
      case 0x21: {
        const decReg = this.fetch8() & 0x07;
        this.registers[decReg] = (this.registers[decReg] - 1) & 0xFFFFFF;
        this.updateFlags(this.registers[decReg]);
        break;
      }
      case 0x22: {
        this.executeInterrupt(this.fetch8() & 0xFF);
        break;
      }
      case 0x23: {
        const divA = this.fetch8() & 0x07;
        const divB = this.registers[this.fetch8() & 0x07];
        if (divB === 0) this.triggerPanic("DIVISION_BY_ZERO");
        else {
          this.registers[divA] = Math.floor(this.registers[divA] / divB) & 0xFFFFFF;
          this.updateFlags(this.registers[divA]);
        }
        break;
      }
      case 0x24: {
        const andRegA = this.fetch8() & 0x07;
        this.registers[andRegA] &= this.registers[this.fetch8() & 0x07];
        this.updateFlags(this.registers[andRegA]);
        break;
      }
      case 0x25: {
        const idivA = this.fetch8() & 0x07;
        const idivB = this.registers[this.fetch8() & 0x07];
        if (idivB === 0) this.triggerPanic("DIVISION_BY_ZERO");
        else {
          const sA = (this.registers[idivA] << 8) >> 8;
          const sB = (idivB << 8) >> 8;
          this.registers[idivA] = Math.floor(sA / sB) & 0xFFFFFF;
          this.updateFlags(this.registers[idivA]);
        }
        break;
      }
      case 0x26: {
        const modA = this.fetch8() & 0x07;
        const modB = this.registers[this.fetch8() & 0x07];
        if (modB === 0) this.triggerPanic("DIVISION_BY_ZERO");
        else {
          this.registers[modA] = (this.registers[modA] % modB) & 0xFFFFFF;
          this.updateFlags(this.registers[modA]);
        }
        break;
      }
      case 0x27: {
        const imodA = this.fetch8() & 0x07;
        const imodB = this.registers[this.fetch8() & 0x07];
        if (imodB === 0) this.triggerPanic("DIVISION_BY_ZERO");
        else {
          const sModA = (this.registers[imodA] << 8) >> 8;
          const sModB = (imodB << 8) >> 8;
          this.registers[imodA] = (sModA % sModB) & 0xFFFFFF;
          this.updateFlags(this.registers[imodA]);
        }
        break;
      }
      case 0x28: {
        const orRegA = this.fetch8() & 0x07;
        this.registers[orRegA] = (this.registers[orRegA] | this.registers[this.fetch8() & 0x07]) & 0xFFFFFF;
        this.updateFlags(this.registers[orRegA]);
        break;
      }
      case 0x29: {
        const xorRegA = this.fetch8() & 0x07;
        this.registers[xorRegA] = (this.registers[xorRegA] ^ this.registers[this.fetch8() & 0x07]) & 0xFFFFFF;
        this.updateFlags(this.registers[xorRegA]);
        break;
      }
      case 0x2A: {
        const notRegA = this.fetch8() & 0x07;
        this.registers[notRegA] = (~this.registers[notRegA]) & 0xFFFFFF;
        this.updateFlags(this.registers[notRegA]);
        break;
      }
      case 0x2B: {
        const shlRegA = this.fetch8() & 0x07;
        const shlRegB = this.registers[this.fetch8() & 0x07];
        this.registers[shlRegA] = (this.registers[shlRegA] << shlRegB) & 0xFFFFFF;
        this.updateFlags(this.registers[shlRegA]);
        break;
      }
      case 0x2C: {
        const shrRegA = this.fetch8() & 0x07;
        const shrRegB = this.registers[this.fetch8() & 0x07];
        this.registers[shrRegA] = (this.registers[shrRegA] >>> shrRegB) & 0xFFFFFF;
        this.updateFlags(this.registers[shrRegA]);
        break;
      }
      case 0x2D: {
        const sarRegA = this.fetch8() & 0x07;
        const sarRegB = this.registers[this.fetch8() & 0x07];
        const signedVal = (this.registers[sarRegA] << 8) >> 8;
        this.registers[sarRegA] = (signedVal >> sarRegB) & 0xFFFFFF;
        this.updateFlags(this.registers[sarRegA]);
        break;
      }
      case 0xFF: break;
      default:
        this.triggerPanic(`ILLEGAL_INSTRUCTION: 0x${opcode.toString(16).toUpperCase()}`);
        break;
    }
  }

  private executeInterrupt(irq: number) {
    const wasEnabled = this.interruptsEnabled;
    this.interruptsEnabled = false;
    const packed = (this.zeroFlag ? 1 : 0) | (this.signFlag ? 2 : 0) | (wasEnabled ? 4 : 0);
    this.push32(packed);
    this.push32(this.pc);
    this.pc = this.read24(IVT_START + (irq * 4));
  }

  private triggerPanic(code: string) {
    this.panic = true; console.error("CPU PANIC:", code, "PC:", this.pc.toString(16));
    this.panicCode = code;
    this.halt = true;
  }

  private push32(val: number) {
    this.sp -= 4;
    this.write32(this.sp, val);
  }

  private pop32(): number {
    const val = this.read32(this.sp);
    this.sp += 4;
    return val;
  }

  private fetch8(): number {
    if (this.pc < 0 || this.pc >= this.memory.length) {
      this.triggerPanic("SEG_FAULT");
      return 0;
    }
    return this.memory[this.pc++] & 0xFF;
  }

  private fetch24(): number {
    const val = this.read24(this.pc);
    this.pc += 3;
    return val;
  }

  private read8(a: number): number {
    return (a < 0 || a >= this.memory.length) ? 0 : this.memory[a] & 0xFF;
  }

  private write8(a: number, v: number) {
    if (a >= 0 && a < this.memory.length) this.memory[a] = v;
  }

  private read24(a: number): number {
    if (a < 0 || a >= this.memory.length - 2) return 0;
    return ((this.memory[a] & 0xFF) << 16) | ((this.memory[a + 1] & 0xFF) << 8) | (this.memory[a + 2] & 0xFF);
  }

  private write24(a: number, v: number) {
    if (a >= 0 && a < this.memory.length - 2) {
      this.memory[a] = (v >> 16) & 0xFF;
      this.memory[a + 1] = (v >> 8) & 0xFF;
      this.memory[a + 2] = v & 0xFF;
    }
  }

  private read32(a: number): number {
    if (a < 0 || a >= this.memory.length - 3) return 0;
    return ((this.memory[a] & 0xFF) << 24) | ((this.memory[a + 1] & 0xFF) << 16) | ((this.memory[a + 2] & 0xFF) << 8) | (this.memory[a + 3] & 0xFF);
  }

  private write32(a: number, v: number) {
    if (a >= 0 && a < this.memory.length - 3) {
      this.memory[a] = (v >> 24) & 0xFF;
      this.memory[a + 1] = (v >> 16) & 0xFF;
      this.memory[a + 2] = (v >> 8) & 0xFF;
      this.memory[a + 3] = v & 0xFF;
    }
  }

  private updateFlags(r: number) {
    this.zeroFlag = (r === 0);
    const signed = (r << 8) >> 8;
    this.signFlag = (signed < 0);
  }
}
