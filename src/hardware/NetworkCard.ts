import { NET_CMD_ADDR, NET_STATE_ADDR } from "./constants";

export class NetworkCard {
  public tick(ram: Uint8Array) {
    const cmd = ram[NET_CMD_ADDR] & 0xFF;
    if (cmd === 0) return;

    if (cmd === 1) {
      ram[NET_STATE_ADDR] = 3; 
      ram[NET_CMD_ADDR] = 0;
    } else if (cmd === 2) {
      ram[NET_STATE_ADDR] = 3; 
      ram[NET_CMD_ADDR] = 0;
    } else if (cmd === 3) {
      ram[NET_CMD_ADDR] = 0;
    } else if (cmd === 4) {
      ram[NET_CMD_ADDR] = 2; 
    } else if (cmd === 5) {
      this.shutdown(ram);
    }
  }

  public shutdown(ram: Uint8Array) {
    ram[NET_STATE_ADDR] = 0;
    ram[NET_CMD_ADDR] = 0;
  }
}
