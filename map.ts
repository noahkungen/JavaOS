import { Assembler } from "./src/hardware/Assembler";
import { readFileSync } from "fs";

const osFiles = {
  "01_bios.asm": readFileSync("os/01_bios.asm", "utf-8"),
  "02_shell.asm": readFileSync("os/02_shell.asm", "utf-8"),
  "03_apps.asm": readFileSync("os/03_apps.asm", "utf-8"),
  "04_kernel.asm": readFileSync("os/04_kernel.asm", "utf-8"),
  "05_strings.asm": readFileSync("os/05_strings.asm", "utf-8"),
};
const fileNames = Object.keys(osFiles).sort();
let osSource = "";
for (const f of fileNames) {
  osSource += `; MODULE: ${f}\n${osFiles[f]}\n`;
}
osSource += "\n:tmr_isr\nIRET\n:kbd_isr\nIRET\n:mouse_isr\nIRET\n";

const as = new Assembler();
as.assemble(osSource, 0x40000);
console.log(Array.from(as.labels.entries()).map(e => `${e[0]}: ${e[1].toString(16)}`).join("\n"));
