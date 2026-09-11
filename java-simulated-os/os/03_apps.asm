:dispatch_cmd
MOV R4, 0x11000
MOV R5, str_ls
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_dir
MOV R4, 0x11000
MOV R5, str_clear
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_cls_sh
MOV R4, 0x11000
MOV R5, str_cat
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_type_args
MOV R4, 0x11000
MOV R5, str_hd
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_hd_args
MOV R4, 0x11000
MOV R5, str_nano
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_edit_args
MOV R4, 0x11000
MOV R5, str_exec
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_run_args
MOV R4, 0x11000
MOV R5, str_rm
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_rm_args
MOV R4, 0x11000
MOV R5, str_mount
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_mount_args
MOV R4, 0x11000
MOV R5, str_color
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_color_args
MOV R4, 0x11000
MOV R5, str_sh
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_sh_args
MOV R4, 0x11000
MOV R5, str_beep
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_beep
MOV R4, 0x11000
MOV R5, str_host
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ chat_host
MOV R4, 0x11000
MOV R5, str_join
CALL strstarts
MOV R7, 1
CMP R0, R7
JZ chat_join

MOV R4, 0x11000
MOV R5, str_time
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_time
MOV R4, 0x11000
MOV R5, str_ver
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_ver
MOV R4, 0x11000
MOV R5, str_cmd
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_cmd
MOV R4, 0x11000
MOV R5, str_help
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_cmd
MOV R4, 0x11000
MOV R5, str_question
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_cmd
MOV R4, 0x11000
MOV R5, str_save
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ verify_save_args
MOV R4, 0x11000
MOV R5, str_echo
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_echo
MOV R4, 0x11000
MOV R5, str_exit
CALL strcmp
MOV R7, 1
CMP R0, R7
JZ handle_exit
CALL bad_cmd
RET

:strstarts
LOAD8_IND R1, R4
LOAD8_IND R2, R5
MOV R7, 0
CMP R2, R7
JZ strstarts_ok
CMP R1, R2
JZ strstarts_match
JMP strstarts_fail
:strstarts_match
INC R4
INC R5
JMP strstarts
:strstarts_ok
MOV R0, 1
RET
:strstarts_fail
MOV R0, 0
RET

:strcmp
LOAD8_IND R1, R4
LOAD8_IND R2, R5
MOV R7, 0
CMP R2, R7
JZ strcmp_end
CMP R1, R2
JZ strcmp_match
JMP strcmp_fail
:strcmp_match
INC R4
INC R5
JMP strcmp
:strcmp_end
MOV R7, 0
CMP R1, R7
JZ strcmp_ok
MOV R7, 32
CMP R1, R7
JZ strcmp_ok
JMP strcmp_fail
:strcmp_ok
MOV R0, 1
RET
:strcmp_fail
MOV R0, 0
RET

:handle_beep
MOV R1, 880
MOV R2, 200
MOV R0, 10
INT 0x21
RET

:verify_sh_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_sh_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_sh_def
MOV R7, 63
CMP R0, R7
JZ show_sh_help
MOV R1, R4
JMP do_sh
:handle_sh_def
CALL bad_cmd
RET

:do_sh
PUSH R1
MOV R4, 0x50000
MOV R0, 3
INT 0x21
MOV R7, 0
CMP R0, R7
JNE sh_err
MOV R5, 0x50000
:sh_line_loop
MOV R6, 0x11000
:sh_char_loop
LOAD8_IND R0, R5
INC R5
MOV R7, 0
CMP R0, R7
JZ sh_exec_last
MOV R7, 10
CMP R0, R7
JZ sh_exec_line
MOV R7, 13
CMP R0, R7
JZ sh_char_loop
STORE8_IND R6, R0
INC R6
JMP sh_char_loop
:sh_exec_line
MOV R7, 0
STORE8_IND R6, R7
MOV R7, 0x11000
CMP R6, R7
JZ sh_line_loop
PUSH R5
MOV R5, 0x11000
CALL dispatch_cmd
POP R5
JMP sh_line_loop
:sh_exec_last
MOV R7, 0
STORE8_IND R6, R7
MOV R7, 0x11000
CMP R6, R7
JZ sh_done
MOV R5, 0x11000
CALL dispatch_cmd
:sh_done
POP R1
RET
:sh_err
POP R1
RET

:verify_color_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_color_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_color_def
MOV R0, R4
CALL parse_num_from_str
MOV R1, R0
MOV R0, 9
INT 0x21
RET
:handle_color_def
MOV R1, 0x1F
MOV R0, 9
INT 0x21
RET

:parse_num_from_str
MOV R1, R0
MOV R0, 0
:pnfs_l
LOAD8_IND R2, R1
MOV R7, 0
CMP R2, R7
JZ pnfs_d
MOV R7, 32
CMP R2, R7
JZ pnfs_d
MOV R7, 48
SUB R2, R7
MOV R7, 10
MUL R0, R7
ADD R0, R2
INC R1
JMP pnfs_l
:pnfs_d
RET

:verify_mount_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ bad_cmd
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ bad_cmd
MOV R7, 63
CMP R0, R7
JZ show_mount_help
MOV R7, 67
CMP R0, R7
JZ mount_c
MOV R7, 68
CMP R0, R7
JZ mount_d
CALL bad_cmd
RET
:mount_c
MOV R0, 0
STORE8 0xA002C, R0
RET
:mount_d
MOV R0, 1
STORE8 0xA002C, R0
RET

:verify_save_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_save_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_save_def
MOV R7, 63
CMP R0, R7
JZ show_save_help
MOV R1, R4
JMP do_save

:verify_type_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_type_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_type_def
MOV R7, 63
CMP R0, R7
JZ show_type_help
MOV R1, R4
JMP do_type

:verify_hd_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_hd_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_hd_def
MOV R7, 63
CMP R0, R7
JZ show_hd_help
MOV R1, R4
JMP do_hd

:verify_edit_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_edit_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_edit_def
MOV R7, 63
CMP R0, R7
JZ show_edit_help
MOV R1, R4
JMP do_edit
:handle_edit_def
MOV R1, str_default_file
JMP do_edit

:verify_run_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_run_def
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ handle_run_def
MOV R1, R4
JMP do_run

:verify_rm_args
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ bad_cmd
CALL skip_spaces
LOAD8_IND R0, R4
MOV R7, 0
CMP R0, R7
JZ bad_cmd
MOV R7, 63
CMP R0, R7
JZ show_rm_help
MOV R1, R4
JMP do_rm

:skip_spaces
LOAD8_IND R0, R4
MOV R7, 32
CMP R0, R7
JNE ss_done
INC R4
JMP skip_spaces
:ss_done
RET

:do_edit
PUSH R1
MOV R4, 0x30000
MOV R0, 3
INT 0x21
CALL handle_cls
MOV R6, 0
:nano_len_loop
MOV R7, 0x30000
ADD R7, R6
LOAD8_IND R0, R7
MOV R7, 0
CMP R0, R7
JZ nano_len_done
INC R6
JMP nano_len_loop
:nano_len_done
MOV R5, R6

:nano_loop
CALL nano_redraw
:nano_wait
CALL check_char
MOV R7, 0
CMP R0, R7
JZ nano_wait

MOV R1, 133
CMP R0, R1
JZ nano_exit
MOV R1, 132
CMP R0, R1
JZ nano_save
MOV R1, 128
CMP R0, R1
JZ nano_left
MOV R1, 129
CMP R0, R1
JZ nano_right
MOV R1, 8
CMP R0, R1
JZ nano_bs

MOV R7, 510
CMP R6, R7
JZ nano_loop
MOV R1, 0x30000
ADD R1, R5
MOV R2, R1
INC R2
MOV R3, R6
SUB R3, R5
PUSH R0
PUSH R4
MOV R4, 0x30000
CALL rl_mmr
POP R4
POP R0
MOV R1, 0x30000
ADD R1, R5
STORE8_IND R1, R0
INC R5
INC R6
JMP nano_loop

:nano_left
MOV R7, 0
CMP R5, R7
JZ nano_wait
DEC R5
CALL nano_calc_cursor
JMP nano_wait
:nano_right
CMP R5, R6
JZ nano_wait
INC R5
CALL nano_calc_cursor
JMP nano_wait

:nano_bs
MOV R7, 0
CMP R5, R7
JZ nano_loop
DEC R5
DEC R6
MOV R1, 0x30000
ADD R1, R5
MOV R2, R1
INC R2
MOV R3, R6
SUB R3, R5
PUSH R4
MOV R4, 0x30000
CALL rl_mml
POP R4
JMP nano_loop

:nano_save
POP R1
PUSH R1
MOV R4, 0x30000
MOV R0, 5
INT 0x21
MOV R7, 254
CMP R0, R7
JZ nano_exit_ro
JMP nano_loop

:nano_exit_ro
POP R1
CALL handle_cls
MOV R4, ro_err_msg
MOV R0, 1
INT 0x21
RET
:nano_exit
POP R1
CALL handle_cls
RET

:nano_redraw
MOV R7, 0
STORE8 0xA0010, R7
STORE8 0xA0011, R7
MOV R1, 0x70
MOV R0, 9
INT 0x21
MOV R4, nano_header_msg
MOV R0, 1
INT 0x21
MOV R1, 0x1F
MOV R0, 9
INT 0x21
MOV R4, 0x30000
CALL print_str
CALL clear_to_eos
:nano_calc_cursor
MOV R1, 0
MOV R2, 1
MOV R4, 0
:nr_l
CMP R4, R5
JZ nr_d
MOV R7, 0x30000
ADD R7, R4
LOAD8_IND R0, R7
MOV R7, 10
CMP R0, R7
JZ nr_nl
INC R1
MOV R7, 40
CMP R1, R7
JZ nr_w
JMP nr_n
:nr_nl
MOV R1, 0
INC R2
JMP nr_n
:nr_w
MOV R1, 0
INC R2
JMP nr_n
:nr_n
INC R4
JMP nr_l
:nr_d
STORE8 0xA0010, R1
STORE8 0xA0011, R2
RET

:clear_to_eos
LOAD8 R1, 0xA0011
MOV R2, 40
MUL R1, R2
LOAD8 R2, 0xA0010
ADD R1, R2
MOV R4, 0xB8000
ADD R4, R1
MOV R5, 0xB9000
ADD R5, R1
MOV R2, 1000
SUB R2, R1
MOV R1, 0xFF
LOAD8 R3, 0xA0012
:cte_loop
MOV R7, 0
CMP R2, R7
JZ cte_done
MOV R7, 0xB83E8
CMP R4, R7
JZ cte_done
STORE8_IND R4, R1
STORE8_IND R5, R3
INC R4
INC R5
DEC R2
JMP cte_loop
:cte_done
RET