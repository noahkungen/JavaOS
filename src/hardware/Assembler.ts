export class Assembler {
  public labels = new Map<string, number>();
  
  public assemble(source: string, baseAddress: number = 0): Uint8Array {
    const lines = source.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith(';'));
    
    // Pass 1: resolve labels
    let pc = baseAddress;
    for (const line of lines) {
      if (line.startsWith(':')) {
        const label = line.substring(1);
        this.labels.set(label, pc);
      } else {
        pc += this.getInstructionSize(line);
      }
    }
    
    // Pass 2: generate binary
    const out: number[] = [];
    for (const line of lines) {
      if (line.startsWith(':')) continue;
      
      const parts = this.tokenize(line);
      const mnemonic = parts[0].toUpperCase();
      
      switch (mnemonic) {
        case "HALT": out.push(0x00); break;
        case "MOV": {
          if (parts.length > 2 && this.isReg(parts[2])) {
            out.push(0x1B, this.reg(parts[1]), this.reg(parts[2]));
          } else {
            out.push(0x01, this.reg(parts[1]));
            this.write24(out, this.resolve(parts[2]));
          }
          break;
        }
        case "LOAD": out.push(0x02, this.reg(parts[1])); this.write24(out, this.resolve(parts[2])); break;
        case "STORE": out.push(0x03); this.write24(out, this.resolve(parts[1])); out.push(this.reg(parts[2])); break;
        case "ADD": out.push(0x04, this.reg(parts[1]), this.reg(parts[2])); break;
        case "JMP": out.push(0x05); this.write24(out, this.resolve(parts[1])); break;
        case "JZ": out.push(0x06); this.write24(out, this.resolve(parts[1])); break;
        case "PUSH": out.push(0x07, this.reg(parts[1])); break;
        case "POP": out.push(0x08, this.reg(parts[1])); break;
        case "CALL": out.push(0x09); this.write24(out, this.resolve(parts[1])); break;
        case "RET": out.push(0x0A); break;
        case "LOAD8": out.push(0x0B, this.reg(parts[1])); this.write24(out, this.resolve(parts[2])); break;
        case "SUB": out.push(0x0C, this.reg(parts[1]), this.reg(parts[2])); break;
        case "CMP": out.push(0x0F, this.reg(parts[1]), this.reg(parts[2])); break;
        case "JNE": out.push(0x10); this.write24(out, this.resolve(parts[1])); break;
        case "LOAD8_IND": out.push(0x12, this.reg(parts[1]), this.reg(parts[2])); break;
        case "STORE8_IND": out.push(0x13, this.reg(parts[1]), this.reg(parts[2])); break;
        case "CLI": out.push(0x14); break;
        case "STI": out.push(0x15); break;
        case "IRET": out.push(0x16); break;
        case "MUL": out.push(0x19, this.reg(parts[1]), this.reg(parts[2])); break;
        case "STORE8": out.push(0x1A); this.write24(out, this.resolve(parts[1])); out.push(this.reg(parts[2])); break;
        case "INC": out.push(0x20, this.reg(parts[1])); break;
        case "DEC": out.push(0x21, this.reg(parts[1])); break;
        case "INT": out.push(0x22, this.resolve(parts[1]) & 0xFF); break;
        case "DIV": out.push(0x23, this.reg(parts[1]), this.reg(parts[2])); break;
        case "AND": out.push(0x24, this.reg(parts[1]), this.reg(parts[2])); break;
        case "IDIV": out.push(0x25, this.reg(parts[1]), this.reg(parts[2])); break;
        case "MOD": out.push(0x26, this.reg(parts[1]), this.reg(parts[2])); break;
        case "IMOD": out.push(0x27, this.reg(parts[1]), this.reg(parts[2])); break;
        case "OR": out.push(0x28, this.reg(parts[1]), this.reg(parts[2])); break;
        case "XOR": out.push(0x29, this.reg(parts[1]), this.reg(parts[2])); break;
        case "NOT": out.push(0x2A, this.reg(parts[1])); break;
        case "SHL": out.push(0x2B, this.reg(parts[1]), this.reg(parts[2])); break;
        case "SHR": out.push(0x2C, this.reg(parts[1]), this.reg(parts[2])); break;
        case "SAR": out.push(0x2D, this.reg(parts[1]), this.reg(parts[2])); break;
        case "NOP": out.push(0xFF); break;
        case "DB": {
          const raw = line.substring(2).trim();
          let inString = false;
          let currentStr = "";
          for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            if (char === '"') {
              if (inString) {
                for (let j = 0; j < currentStr.length; j++) out.push(currentStr.charCodeAt(j));
                inString = false;
              } else {
                inString = true;
                currentStr = "";
              }
            } else if (inString) {
              currentStr += char;
            } else if (char.match(/[0-9xXA-Fa-f]/)) {
              let numStr = char;
              while (i + 1 < raw.length && raw[i+1].match(/[0-9xXA-Fa-f]/)) {
                numStr += raw[++i];
              }
              if (numStr) out.push(this.resolve(numStr) & 0xFF);
            }
          }
          break;
        }
        default:
          throw new Error(`Unknown instruction: ${mnemonic}`);
      }
    }
    
    return new Uint8Array(out);
  }

  private getInstructionSize(line: string): number {
    const parts = this.tokenize(line);
    const m = parts[0].toUpperCase();
    switch (m) {
      case "HALT": case "RET": case "STI": case "IRET": case "CLI": case "NOP": return 1;
      case "DEC": case "INC": case "INT": case "PUSH": case "POP": case "NOT": return 2;
      case "ADD": case "SUB": case "MUL": case "DIV": case "CMP": case "LOAD8_IND": 
      case "STORE8_IND": case "AND": case "IDIV": case "MOD": case "IMOD": case "OR": 
      case "XOR": case "SHL": case "SHR": case "SAR": return 3;
      case "MOV": return (parts.length > 2 && this.isReg(parts[2])) ? 3 : 5;
      case "JMP": case "JZ": case "CALL": case "JNE": return 4;
      case "LOAD": case "STORE": case "LOAD8": case "STORE8": return 5;
      case "DB": {
        const raw = line.substring(2).trim();
        let size = 0;
        let inString = false;
        for (let i = 0; i < raw.length; i++) {
          if (raw[i] === '"') {
            inString = !inString;
          } else if (inString) {
            size++;
          } else if (raw[i].match(/[0-9xXA-Fa-f]/)) {
            size++;
            while (i + 1 < raw.length && raw[i+1].match(/[0-9xXA-Fa-f]/)) i++;
          }
        }
        return size;
      }
      default: return 0;
    }
  }

  private tokenize(line: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inString = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inString = !inString;
        current += c;
      } else if (!inString && (c === ' ' || c === ',')) {
        if (current.length > 0) parts.push(current);
        current = "";
      } else {
        current += c;
      }
    }
    if (current.length > 0) parts.push(current);
    return parts;
  }

  private isReg(s: string): boolean {
    return s.toUpperCase().startsWith("R") && !isNaN(parseInt(s.substring(1)));
  }

  private reg(s: string): number {
    return parseInt(s.toUpperCase().substring(1));
  }

  private write24(out: number[], val: number) {
    out.push((val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
  }

  private resolve(val: string): number {
    if (this.labels.has(val)) return this.labels.get(val)!;
    if (val.toLowerCase().startsWith("0x")) return parseInt(val.substring(2), 16);
    return parseInt(val, 10);
  }
}
