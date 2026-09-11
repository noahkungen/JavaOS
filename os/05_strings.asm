:str_ls
DB "LS"
DB 0
:str_clear
DB "CLEAR"
DB 0
:str_cat
DB "CAT"
DB 0
:str_hd
DB "HD"
DB 0
:str_nano
DB "NANO"
DB 0
:str_rm
DB "RM"
DB 0
:str_exec
DB "EXEC"
DB 0
:str_mount
DB "MOUNT"
DB 0
:str_color
DB "COLOR"
DB 0
:str_sh
DB "SH"
DB 0
:str_beep
DB "BEEP"
DB 0
:str_host
DB "HOST"
DB 0
:str_join
DB "JOIN "
DB 0
:str_time
DB "TIME"
DB 0
:str_ver
DB "VER"
DB 0
:str_cmd
DB "CMD"
DB 0
:str_help
DB "HELP"
DB 0
:str_question
DB "?"
DB 0
:str_save
DB "SAVE"
DB 0
:str_echo
DB "ECHO"
DB 0
:str_exit
DB "EXIT"
DB 0
:str_default_file
DB "TEXT"
DB 0
:str_app_file
DB "APP"
DB 0
:str_cdrom
DB "CD-ROM"
DB 0
:str_hdd
DB "HARD DISK"
DB 0
:str_autorun
DB "AUTORUN"
DB 0
:post_title
DB "IRON-NIX KERNEL v14.00"
DB 10, 0
:post_mem_msg
DB "MEM TEST... "
DB 0
:post_kb_msg
DB " KB PASSED"
DB 10, 0
:post_disk_msg
DB "MOUNT /dev/sda0... "
DB 0
:post_ok_msg
DB "OK"
DB 10, 0
:post_err_msg
DB "KERNEL PANIC: MEM FAIL"
DB 10, 0
:bios_enter_msg
DB "PRESS 'S' FOR BIOS SETUP..."
DB 10, 0
:setup_title
DB "--- BIOS SETUP ---"
DB 10, 0
:setup_opt1
DB "1. BOOT DEVICE: "
DB 0
:setup_exit_msg
DB "PRESS 'X' TO REBOOT"
DB 10, 0
:boot_msg
DB "INIT BOOT SEQUENCE..."
DB 10, 0
:prompt_p1
DB "ROOT@IRON/"
DB 0
:prompt_p2
DB ":~# "
DB 0
:ver_msg
DB "Iron-nix OS v14.00 Modular"
DB 10, 0
:help_msg
DB "LS CAT NANO RM EXEC MOUNT COLOR SH BEEP HOST JOIN SAVE EXIT"
DB 10, 0
:save_msg
DB "SYNC..."
DB 10, 0
:type_msg
DB "READ..."
DB 10, 0
:hd_msg
DB "HEX DUMP..."
DB 10, 0
:nano_header_msg
DB "--- NANO EDITOR (^S SAVE, ^X EXIT) ---"
DB 10, 0
:run_msg
DB "FORK PROCESS..."
DB 10, 0
:rm_msg
DB "UNLINKING..."
DB 10, 0
:exit_msg
DB "SYSTEM HALTED."
DB 10, 0
:chat_wait_msg
DB "WAITING FOR PEERS... (ESC TO ABORT)"
DB 10, 0
:chat_conn_msg
DB "CONNECTING TO HOST..."
DB 10, 0
:chat_err_msg
DB "NETWORK ERROR."
DB 10, 0
:chat_hdr_msg
DB "--- IRON NETCHAT (ESC TO EXIT) ---"
DB 10, 0
:chat_you_msg
DB "[YOU]: "
DB 0
:chat_peer_msg
DB "[PEER]: "
DB 0
:err_msg
DB "BASH: COMMAND NOT FOUND"
DB 10, 0
:io_err_msg
DB "I/O ERROR OR DISK FULL"
DB 10, 0
:not_found_msg
DB "NO SUCH FILE OR DIRECTORY"
DB 10, 0
:ok_msg
DB "SUCCESS"
DB 10, 0
:ro_err_msg
DB "READ ONLY FILE SYSTEM"
DB 10, 0
:save_help_msg
DB "Syntax: SAVE  (Saves buffer to file)"
DB 10, 0
:type_help_msg
DB "Syntax: CAT  (Outputs text file to stdout)"
DB 10, 0
:hd_help_msg
DB "Syntax: HD  (Hexdump binary files)"
DB 10, 0
:edit_help_msg
DB "Syntax: NANO  (Full-screen text editor)"
DB 10, 0
:rm_help_msg
DB "Syntax: RM  (Removes file from filesystem)"
DB 10, 0
:mount_help_msg
DB "Syntax: MOUNT <C|D> (Switch active drive)"
DB 10, 0
:color_help_msg
DB "Syntax: COLOR <0-255> (Set text color attr)"
DB 10, 0
:sh_help_msg
DB "Syntax: SH  (Execute shell script)"
DB 10, 0
:hex_chars
DB "0123456789ABCDEF"
:r0_temp
DB 0, 0