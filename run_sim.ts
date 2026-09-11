import { Machine } from "./src/hardware/Machine";
import { readFileSync } from "fs";

const osFiles = {
  "01_bios.asm": readFileSync("os/01_bios.asm", "utf-8"),
  "02_shell.asm": readFileSync("os/02_shell.asm", "utf-8"),
  "03_apps.asm": readFileSync("os/03_apps.asm", "utf-8"),
  "04_kernel.asm": readFileSync("os/04_kernel.asm", "utf-8"),
  "05_strings.asm": readFileSync("os/05_strings.asm", "utf-8"),
};

const machine = new Machine();
machine.powerOn(osFiles).then(() => {
  for (let i = 0; i < 1000000; i++) {
    if (machine.cpu.isPanic()) {
      console.log("PANIC:", machine.cpu.getPanicCode(), "at PC:", machine.cpu.getPC().toString(16));
      break;
    }
    if (machine.cpu.halt) {
      console.log("HALTED at PC:", machine.cpu.getPC().toString(16));
      break;
    }
    machine.cpu.step();
  }
  console.log("Done");
});
