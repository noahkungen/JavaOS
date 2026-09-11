export const MEM_SIZE = 1024 * 1024;
export const KBD_ADDR = 0x0A000;
export const TEXT_ADDR = 0xB8000;
export const ATTR_ADDR = 0xB9000;
export const FONT_ADDR = 0xBA000;
export const CURSOR_X_ADDR = 0xA0010;
export const CURSOR_Y_ADDR = 0xA0011;
export const CURRENT_COLOR_ADDR = 0xA0012;
export const ROM_ADDR = 0x40000;
export const IVT_START = 0x00000;

export const RTC_YEAR_HI_ADDR = 0xA0030;
export const RTC_YEAR_LO_ADDR = 0xA0031;
export const RTC_MONTH_ADDR   = 0xA0032;
export const RTC_DAY_ADDR     = 0xA0033;
export const RTC_HOUR_ADDR    = 0xA0034;
export const RTC_MIN_ADDR     = 0xA0035;
export const RTC_SEC_ADDR     = 0xA0036;
export const CMOS_ADDR        = 0x003F0;

export const BEEP_FREQ_ADDR = 0xA0040;
export const BEEP_DUR_ADDR  = 0xA0042;
export const BEEP_CMD_ADDR  = 0xA0044;

export const NET_CMD_ADDR   = 0xA0050;
export const NET_STATE_ADDR = 0xA0051;
export const NET_BUFFER_ADDR= 0xA0052;

export const MOUSE_X_ADDR   = 0xA0060;
export const MOUSE_Y_ADDR   = 0xA0062;
export const MOUSE_BTN_ADDR = 0xA0064;
