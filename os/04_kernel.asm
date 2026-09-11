:handle_cls_sh
CALL handle_cls
RET

:handle_cls
MOV R4, 0xB8000
MOV R5, 0xB9000
MOV R1, 0xFF
LOAD8 R3, 0xA0012
MOV R2, 2000
:cls_loop
STORE8_IND R4, R1
STORE8_IND R5, R3
INC R4
INC R5
DEC R2
MOV R7, 0
CMP R2, R7
JZ cls_done
JMP cls_loop
:cls_done
STORE8 0xA0010, R7
STORE8 0xA0011, R7
RET

:handle_ver
MOV R4, ver_msg
MOV R0, 1
INT 0x21
RET
:handle_cmd
MOV R4, help_msg
MOV R0, 1
INT 0x21
RET
:handle_exit
MOV R4, exit_msg
MOV R0, 1
INT 0x21
HALT

:handle_echo
CALL skip_spaces
MOV R0, 1
INT 0x21
MOV R0, 10
CALL put_char
RET

:handle_save_def
MOV R1, str_default_file
JMP do_save
:do_save
PUSH R1
MOV R4, save_msg
MOV R0, 1
INT 0x21
POP R1
MOV R4, 0x30000
MOV R0, 5
INT 0x21
MOV R7, 254
CMP R0, R7
JZ cmd_ro_err
MOV R7, 0
CMP R0, R7
JNE save_err
MOV R4, ok_msg
MOV R0, 1
INT 0x21
RET
:save_err
MOV R4, io_err_msg
MOV R0, 1
INT 0x21
RET

:handle_type_def
MOV R1, str_default_file
JMP do_type
:do_type
PUSH R1
MOV R4, type_msg
MOV R0, 1
INT 0x21
POP R1
MOV R4, 0x30000
MOV R0, 3
INT 0x21
MOV R7, 0
CMP R0, R7
JNE type_err
MOV R4, 0x30000
MOV R0, 1
INT 0x21
MOV R0, 10
CALL put_char
RET
:type_err
MOV R4, not_found_msg
MOV R0, 1
INT 0x21
RET

:handle_hd_def
MOV R1, str_app_file
JMP do_hd
:do_hd
PUSH R1
MOV R4, hd_msg
MOV R0, 1
INT 0x21
POP R1
MOV R4, 0x30000
MOV R0, 3
INT 0x21
MOV R7, 0
CMP R0, R7
JNE type_err
CALL print_hex_buffer
RET

:handle_run_def
MOV R1, str_app_file
JMP do_run
:do_run
PUSH R1
MOV R4, run_msg
MOV R0, 1
INT 0x21
POP R1
MOV R4, 0x40000
MOV R0, 3
INT 0x21
MOV R7, 0
CMP R0, R7
JNE run_err
CALL 0x40000
RET
:run_err
MOV R4, not_found_msg
MOV R0, 1
INT 0x21
RET

:do_rm
PUSH R1
MOV R4, rm_msg
MOV R0, 1
INT 0x21
POP R1
MOV R4, 0x30000
MOV R0, 8
INT 0x21
MOV R7, 254
CMP R0, R7
JZ cmd_ro_err
MOV R7, 0
CMP R0, R7
JNE rm_err
MOV R4, ok_msg
MOV R0, 1
INT 0x21
RET
:rm_err
MOV R4, not_found_msg
MOV R0, 1
INT 0x21
RET

:cmd_ro_err
MOV R4, ro_err_msg
MOV R0, 1
INT 0x21
RET

:handle_dir
MOV R4, 0x30000
MOV R0, 6
INT 0x21
MOV R4, 0x30000
MOV R0, 1
INT 0x21
RET

:handle_time
LOAD8 R0, 0xA0034
CALL print_num
MOV R0, 58
CALL put_char
LOAD8 R0, 0xA0035
CALL print_num
MOV R0, 10
CALL put_char
RET

:bad_cmd
MOV R4, err_msg
MOV R0, 1
INT 0x21
RET

:kernel_dispatch
MOV R7, 1
CMP R0, R7
JZ kd_do_1
MOV R7, 2
CMP R0, R7
JZ kd_do_2
MOV R7, 3
CMP R0, R7
JZ kd_do_3
MOV R7, 4
CMP R0, R7
JZ kd_do_4
MOV R7, 5
CMP R0, R7
JZ kd_do_5
MOV R7, 6
CMP R0, R7
JZ kd_do_6
MOV R7, 7
CMP R0, R7
JZ kd_do_7
MOV R7, 8
CMP R0, R7
JZ kd_do_8
MOV R7, 9
CMP R0, R7
JZ kd_do_9
MOV R7, 10
CMP R0, R7
JZ kd_do_10
MOV R7, 11
CMP R0, R7
JZ kd_do_11
MOV R7, 12
CMP R0, R7
JZ kd_do_12
MOV R7, 13
CMP R0, R7
JZ kd_do_13
MOV R7, 14
CMP R0, R7
JZ kd_do_14
MOV R7, 15
CMP R0, R7
JZ kd_do_15
IRET

:kd_do_1
CALL print_str
IRET
:kd_do_2
CALL read_sector
IRET
:kd_do_3
CALL read_file
IRET
:kd_do_4
CALL get_char
IRET
:kd_do_5
CALL write_file
IRET
:kd_do_6
CALL list_files
IRET
:kd_do_7
CALL write_sector
IRET
:kd_do_8
CALL delete_file
IRET
:kd_do_9
STORE8 0xA0012, R1
IRET
:kd_do_10
CALL sys_beep
IRET
:kd_do_11
MOV R7, 1
STORE8 0xA0050, R7
IRET
:kd_do_12
STORE 0xA0052, R1
MOV R7, 2
STORE8 0xA0050, R7
IRET
:kd_do_13
STORE 0xA0052, R1
MOV R7, 3
STORE8 0xA0050, R7
IRET
:kd_do_14
CALL net_recv
IRET
:kd_do_15
MOV R7, 5
STORE8 0xA0050, R7
IRET

:net_recv
STORE 0xA0052, R1
MOV R7, 4
STORE8 0xA0050, R7
:wait_nrecv
LOAD8 R7, 0xA0050
MOV R2, 1
CMP R7, R2
JZ nrecv_got
MOV R2, 2
CMP R7, R2
JZ nrecv_empty
JMP wait_nrecv
:nrecv_got
MOV R0, 1
MOV R7, 0
STORE8 0xA0050, R7
RET
:nrecv_empty
MOV R0, 0
MOV R7, 0
STORE8 0xA0050, R7
RET

:read_file
STORE 0xA0020, R1
STORE 0xA0024, R4
MOV R7, 3
STORE8 0xA0028, R7
:wait_rf
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_rf_done
MOV R2, 0xFF
CMP R7, R2
JZ wait_rf_err
JMP wait_rf
:wait_rf_err
MOV R0, 1
RET
:wait_rf_done
MOV R0, 0
RET

:write_file
STORE 0xA0020, R1
STORE 0xA0024, R4
MOV R7, 4
STORE8 0xA0028, R7
:wait_wf
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_wf_done
MOV R2, 0xFE
CMP R7, R2
JZ wait_wf_ro
MOV R2, 0xFF
CMP R7, R2
JZ wait_wf_err
JMP wait_wf
:wait_wf_ro
MOV R0, 254
RET
:wait_wf_err
MOV R0, 1
RET
:wait_wf_done
MOV R0, 0
RET

:list_files
STORE 0xA0024, R4
MOV R7, 5
STORE8 0xA0028, R7
:wait_lf
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_lf_done
JMP wait_lf
:wait_lf_done
RET

:delete_file
STORE 0xA0020, R1
MOV R7, 6
STORE8 0xA0028, R7
:wait_df
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_df_done
MOV R2, 0xFE
CMP R7, R2
JZ wait_df_ro
MOV R2, 0xFF
CMP R7, R2
JZ wait_df_err
JMP wait_df
:wait_df_ro
MOV R0, 254
RET
:wait_df_err
MOV R0, 1
RET
:wait_df_done
MOV R0, 0
RET

:read_sector
STORE 0xA0020, R1
STORE 0xA0024, R4
MOV R7, 1
STORE8 0xA0028, R7
:wait_r
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_r_done
JMP wait_r
:wait_r_done
RET

:write_sector
STORE 0xA0020, R1
STORE 0xA0024, R4
MOV R7, 2
STORE8 0xA0028, R7
:wait_w
LOAD8 R7, 0xA0028
MOV R2, 0
CMP R7, R2
JZ wait_w_done
JMP wait_w
:wait_w_done
RET

:get_char
STI
LOAD8 R0, 0xA000
MOV R7, 0
CMP R0, R7
JZ get_char
CLI
STORE8 0xA000, R7
RET

:print_str
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ end_print
CALL put_char
INC R4
JMP print_str
:end_print
RET

:put_char
MOV R7, 10
CMP R0, R7
JZ handle_newline
LOAD8 R1, 0xA0011
MOV R2, 40
MUL R1, R2
LOAD8 R2, 0xA0010
ADD R1, R2
MOV R2, 0xB8000
ADD R2, R1
STORE8_IND R2, R0
MOV R2, 0xB9000
ADD R2, R1
LOAD8 R7, 0xA0012
STORE8_IND R2, R7
LOAD8 R2, 0xA0010
INC R2
MOV R7, 40
CMP R2, R7
JZ handle_newline
STORE8 0xA0010, R2
RET

:handle_newline
MOV R7, 0
STORE8 0xA0010, R7
LOAD8 R1, 0xA0011
INC R1
MOV R7, 25
CMP R1, R7
JZ scroll_screen
STORE8 0xA0011, R1
RET

:scroll_screen
PUSH R4
PUSH R5
PUSH R2
PUSH R0
MOV R4, 0xB8028
MOV R5, 0xB8000
MOV R2, 960
:scroll_loop
LOAD8_IND R0, R4
STORE8_IND R5, R0
INC R4
INC R5
DEC R2
MOV R7, 0
CMP R2, R7
JNE scroll_loop
MOV R4, 0xB9028
MOV R5, 0xB9000
MOV R2, 960
:scroll_loop_c
LOAD8_IND R0, R4
STORE8_IND R5, R0
INC R4
INC R5
DEC R2
MOV R7, 0
CMP R2, R7
JNE scroll_loop_c
:clear_last_line
MOV R4, 0xB83C0
MOV R5, 0xB93C0
MOV R2, 40
MOV R1, 0xFF
LOAD8 R3, 0xA0012
:clear_loop
STORE8_IND R4, R1
STORE8_IND R5, R3
INC R4
INC R5
DEC R2
MOV R7, 0
CMP R2, R7
JNE clear_loop
:scroll_done
MOV R7, 24
STORE8 0xA0011, R7
POP R0
POP R2
POP R5
POP R4
RET

:print_num
MOV R3, 0
MOV R7, 0
CMP R0, R7
JNE pn_loop
MOV R0, 48
CALL put_char
RET
:pn_loop
MOV R1, R0
MOV R2, 10
DIV R1, R2
MUL R1, R2
MOV R2, R0
SUB R2, R1
PUSH R2
INC R3
MOV R2, 10
DIV R0, R2
MOV R7, 0
CMP R0, R7
JZ pn_print_loop
JMP pn_loop
:pn_print_loop
POP R0
MOV R7, 48
ADD R0, R7
CALL put_char
DEC R3
MOV R7, 0
CMP R3, R7
JZ pn_done
JMP pn_print_loop
:pn_done
RET

:print_hex_buffer
MOV R5, 0x30000
MOV R6, 128
MOV R3, 8
:ph_loop
LOAD8_IND R0, R5
CALL print_hex_byte
MOV R0, 32
CALL put_char
INC R5
DEC R6
MOV R7, 0
CMP R6, R7
JZ ph_done
DEC R3
CMP R3, R7
JNE ph_loop
MOV R0, 10
CALL put_char
MOV R3, 8
JMP ph_loop
:ph_done
MOV R0, 10
CALL put_char
RET

:print_hex_byte
MOV R1, R0
MOV R2, 16
DIV R1, R2
MUL R1, R2
MOV R2, R0
SUB R2, R1
MOV R1, R0
MOV R7, 16
DIV R1, R7
PUSH R2
MOV R0, R1
MOV R7, hex_chars
ADD R7, R0
LOAD8_IND R0, R7
CALL put_char
POP R2
MOV R0, R2
MOV R7, hex_chars
ADD R7, R0
LOAD8_IND R0, R7
CALL put_char
RET

:check_char
LOAD8 R0, 0xA000
MOV R7, 0
CMP R0, R7
JZ cc_done
STORE8 0xA000, R7
:cc_done
RET

:sys_beep
STORE 0xA0040, R1
STORE 0xA0042, R2
MOV R7, 1
STORE8 0xA0044, R7
:wait_beep
LOAD8 R7, 0xA0044
MOV R3, 0
CMP R7, R3
JNE wait_beep
RET

:show_save_help
MOV R4, save_help_msg
MOV R0, 1
INT 0x21
RET
:show_type_help
MOV R4, type_help_msg
MOV R0, 1
INT 0x21
RET
:show_hd_help
MOV R4, hd_help_msg
MOV R0, 1
INT 0x21
RET
:show_edit_help
MOV R4, edit_help_msg
MOV R0, 1
INT 0x21
RET
:show_rm_help
MOV R4, rm_help_msg
MOV R0, 1
INT 0x21
RET
:show_mount_help
MOV R4, mount_help_msg
MOV R0, 1
INT 0x21
RET
:show_sh_help
MOV R4, sh_help_msg
MOV R0, 1
INT 0x21
RET

:chat_host
MOV R0, 11
INT 0x21
MOV R4, chat_wait_msg
MOV R0, 1
INT 0x21
JMP chat_wait_loop

:chat_join
MOV R4, 0x11000
CALL skip_spaces
MOV R4, 0x11004
CALL skip_spaces
MOV R1, R4
MOV R0, 12
INT 0x21
MOV R4, chat_conn_msg
MOV R0, 1
INT 0x21
:chat_wait_loop
LOAD8 R7, 0xA0051
MOV R0, 2
CMP R7, R0
JZ chat_start
MOV R0, 3
CMP R7, R0
JZ chat_err
CALL check_char
MOV R7, 27
CMP R0, R7
JZ chat_exit
JMP chat_wait_loop

:chat_err
MOV R4, chat_err_msg
MOV R0, 1
INT 0x21
RET

:chat_start
CALL handle_cls
MOV R1, 0x1B
MOV R0, 9
INT 0x21
MOV R4, chat_hdr_msg
MOV R0, 1
INT 0x21
MOV R1, 0x1F
MOV R0, 9
INT 0x21
MOV R4, chat_you_msg
MOV R0, 1
INT 0x21
MOV R6, 0
:chat_loop
MOV R1, 0x40000
MOV R0, 14
INT 0x21
MOV R7, 1
CMP R0, R7
JNE chat_kbd
CALL chat_clear_line
MOV R1, 0x1A
MOV R0, 9
INT 0x21
MOV R4, chat_peer_msg
MOV R0, 1
INT 0x21
MOV R4, 0x40000
MOV R0, 1
INT 0x21
MOV R1, 0x1F
MOV R0, 9
INT 0x21
MOV R4, chat_you_msg
MOV R0, 1
INT 0x21
MOV R4, 0x40100
MOV R0, 1
INT 0x21
:chat_kbd
CALL check_char
MOV R7, 0
CMP R0, R7
JZ chat_loop
MOV R7, 27
CMP R0, R7
JZ chat_exit
MOV R7, 10
CMP R0, R7
JZ chat_send
MOV R7, 8
CMP R0, R7
JZ chat_bs
MOV R7, 0x40100
ADD R7, R6
STORE8_IND R7, R0
INC R6
MOV R7, 0
MOV R2, 0x40100
ADD R2, R6
STORE8_IND R2, R7
CALL put_char
JMP chat_loop
:chat_bs
MOV R7, 0
CMP R6, R7
JZ chat_loop
DEC R6
MOV R7, 0
MOV R2, 0x40100
ADD R2, R6
STORE8_IND R2, R7
LOAD8 R2, 0xA0010
DEC R2
STORE8 0xA0010, R2
MOV R0, 32
CALL put_char
LOAD8 R2, 0xA0010
DEC R2
STORE8 0xA0010, R2
JMP chat_loop
:chat_send
CALL chat_clear_line
MOV R1, 0x1E
MOV R0, 9
INT 0x21
MOV R4, chat_you_msg
MOV R0, 1
INT 0x21
MOV R4, 0x40100