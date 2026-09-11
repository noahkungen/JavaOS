package com.javaos.hardware;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

public class Assembler {
    public final Map<String, Integer> labels = new HashMap<>();
    private boolean isReg(String s) { return s != null && s.toUpperCase().matches("R[0-7]"); }
    
    public byte[] assemble(String src, int start) {
        labels.clear(); String[] lines = src.split("\n"); int addr = start;
        for (String s : lines) {
            s = s.trim(); if (s.isEmpty() || s.startsWith(";")) continue;
            if (s.startsWith(":")) {
                String labelName = s.substring(1).split("[\\s;]+")[0];
                labels.put(labelName, addr);
            } else addr += calculateLineSize(s);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (String s : lines) {
            s = s.trim(); if (s.isEmpty() || s.startsWith(":") || s.startsWith(";")) continue;
            String[] p = s.split("[\\s,]+"); String m = p[0].toUpperCase();
            switch (m) {
                case "HALT" -> out.write(0x00);
                case "MOV" -> {
                    if (p.length > 2 && isReg(p[2])) { out.write(0x1B); out.write(reg(p[1])); out.write(reg(p[2])); }
                    else { out.write(0x01); out.write(reg(p[1])); write24(out, resolve(p[2])); }
                }
                case "LOAD" -> { out.write(0x02); out.write(reg(p[1])); write24(out, resolve(p[2])); }
                case "STORE" -> { out.write(0x03); write24(out, resolve(p[1])); out.write(reg(p[2])); }
                case "ADD" -> { out.write(0x04); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "SUB" -> { out.write(0x0C); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "MUL" -> { out.write(0x19); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "DIV" -> { out.write(0x23); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "CMP" -> { out.write(0x0F); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "JMP" -> { out.write(0x05); write24(out, resolve(p[1])); }
                case "JZ" -> { out.write(0x06); write24(out, resolve(p[1])); }
                case "CALL" -> { out.write(0x09); write24(out, resolve(p[1])); }
                case "RET" -> out.write(0x0A);
                case "LOAD8" -> { out.write(0x0B); out.write(reg(p[1])); write24(out, resolve(p[2])); }
                case "JNE" -> { out.write(0x10); write24(out, resolve(p[1])); } 
                case "LOAD8_IND" -> { out.write(0x12); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "STORE8_IND" -> { out.write(0x13); out.write(reg(p[1])); out.write(reg(p[2])); }
                case "STI" -> out.write(0x15);
                case "IRET" -> out.write(0x16);
                case "CLI" -> out.write(0x14); 
                case "STORE8" -> { out.write(0x1A); write24(out, resolve(p[1])); out.write(reg(p[2])); }
                case "INC" -> { out.write(0x20); out.write(reg(p[1])); }
                case "DEC" -> { out.write(0x21); out.write(reg(p[1])); }
                case "INT" -> { out.write(0x22); out.write(val(p[1])); }
                case "PUSH" -> { out.write(0x07); out.write(reg(p[1])); }
                case "POP" -> { out.write(0x08); out.write(reg(p[1])); }
                case "DB" -> { 
                    String d = s.substring(2).trim();
                    if (d.startsWith("\"")) {
                        String inner = d.substring(1, d.lastIndexOf("\""));
                        for (char c : inner.toCharArray()) out.write((byte)c);
                    } else for (String b : d.split(",")) out.write((byte)val(b.trim()));
                }
            }
        }
        return out.toByteArray();
    }

    private int calculateLineSize(String line) {
        String[] p = line.trim().split("[\\s,]+"); String m = p[0].toUpperCase();
        return switch (m) {
            case "HALT", "RET", "STI", "IRET", "CLI" -> 1;
            case "DEC", "INC", "INT", "PUSH", "POP" -> 2;
            case "ADD", "SUB", "MUL", "DIV", "CMP", "LOAD8_IND", "STORE8_IND" -> 3;
            case "MOV" -> (p.length > 2 && isReg(p[2])) ? 3 : 5;
            case "JMP", "JZ", "CALL", "JNE" -> 4;
            case "LOAD", "STORE", "LOAD8", "STORE8" -> 5;
            case "DB" -> {
                String d = line.trim().substring(2).trim();
                if (d.startsWith("\"")) yield d.substring(1, d.lastIndexOf("\"")).length();
                else yield d.split(",").length;
            }
            default -> 1;
        };
    }

    private int resolve(String s) { return labels.getOrDefault(s, val(s)); }
    private int reg(String s) { return Integer.parseInt(s.toUpperCase().replace("R", "")); }
    private int val(String s) { 
        if (s.toUpperCase().startsWith("0X")) return (int)Long.parseLong(s.substring(2), 16);
        try { return Integer.parseInt(s); } catch(Exception e) { return 0; }
    }

    // Saknad hjälpmetod fixad!
    private void write24(ByteArrayOutputStream out, int val) {
        out.write((val >> 16) & 0xFF); 
        out.write((val >> 8) & 0xFF); 
        out.write(val & 0xFF);
    }
}