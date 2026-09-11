:bios_entry
CLI
MOV R1, 0
STORE8 0xA000, R1
MOV R1, kernel_dispatch
STORE 0x00084, R1
CALL handle_cls

:start_post
MOV R1, 0x1B
MOV R0, 9
INT 0x21
MOV R4, post_title
CALL print_str
MOV R1, 0x1F
MOV R0, 9
INT 0x21
MOV R4, post_mem_msg
CALL print_str

MOV R1, 0x00400
MOV R2, 0x55
:mem_test_loop
STORE8_IND R1, R2
LOAD8_IND R3, R1
CMP R2, R3
JNE post_fail
MOV R3, 0
STORE8_IND R1, R3
INC R1
MOV R7, 0x10000
CMP R1, R7
JZ post_mem_ok
JMP mem_test_loop

:post_mem_ok
MOV R1, 0x1A
MOV R0, 9
INT 0x21
MOV R0, 64
CALL print_num
MOV R4, post_kb_msg
CALL print_str

MOV R1, 0x1F
MOV R0, 9
INT 0x21
MOV R4, post_disk_msg
CALL print_str
MOV R0, 0
STORE8 0xA002C, R0
MOV R1, 0
MOV R4, 0x30000
MOV R0, 2
INT 0x21

MOV R1, 0x1A
MOV R0, 9
INT 0x21
MOV R4, post_ok_msg
CALL print_str
MOV R1, 0x1F
MOV R0, 9
INT 0x21

MOV R4, bios_enter_msg
CALL print_str
MOV R3, 200
:bios_wait_loop
LOAD8 R0, 0xA000
MOV R7, 83
CMP R0, R7
JZ enter_setup
MOV R1, 2000
:delay_inner
DEC R1
MOV R7, 0
CMP R1, R7
JNE delay_inner
DEC R3
CMP R3, R7
JZ system_boot
JMP bios_wait_loop

:enter_setup
MOV R7, 0
STORE8 0xA000, R7
MOV R1, 0x70
MOV R0, 9
INT 0x21
CALL handle_cls
MOV R4, setup_title
CALL print_str
MOV R4, setup_opt1
CALL print_str
LOAD8 R0, 0x003F0
MOV R7, 0
CMP R0, R7
JZ print_hdd
MOV R4, str_cdrom
JMP print_opt_end
:print_hdd
MOV R4, str_hdd
:print_opt_end
CALL print_str
MOV R0, 10
CALL put_char
MOV R4, setup_exit_msg
CALL print_str
:setup_loop
LOAD8 R0, 0xA000
MOV R7, 49
CMP R0, R7
JZ toggle_boot
MOV R7, 88
CMP R0, R7
JZ bios_entry
JMP setup_loop
:toggle_boot
MOV R7, 0
STORE8 0xA000, R7
LOAD8 R0, 0x003F0
MOV R7, 1
CMP R0, R7
JZ set_hdd
MOV R0, 1
STORE8 0x003F0, R0
JMP enter_setup
:set_hdd
MOV R0, 0
STORE8 0x003F0, R0
JMP enter_setup

:post_fail
MOV R1, 0x1C
MOV R0, 9
INT 0x21
MOV R4, post_err_msg
CALL print_str
HALT

:system_boot
MOV R1, 0x1F
MOV R0, 9
INT 0x21
CALL handle_cls
MOV R1, 0
STORE8 0xA000, R1
MOV R4, boot_msg
CALL print_str
STI

MOV R0, 0
STORE8 0xA002C, R0
MOV R1, str_autorun
CALL do_sh
LOAD8 R0, 0x003F0
STORE8 0xA002C, R0