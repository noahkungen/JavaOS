package com.javaos.hardware;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

public class NetworkCard {
    public static final int NET_CMD_ADDR = 0xA0050;
    public static final int NET_STATE_ADDR = 0xA0051;
    public static final int NET_BUFFER_ADDR = 0xA0052;

    private ServerSocket serverSocket;
    private Socket netSocket;
    private PrintWriter netOut;
    private BufferedReader netIn;
    private boolean isHost = false;
    private final List<PrintWriter> hostClients = Collections.synchronizedList(new ArrayList<>());
    private final ConcurrentLinkedQueue<String> incomingMessages = new ConcurrentLinkedQueue<>();

    public void tick(byte[] ram, boolean poweredOn) {
        int cmd = ram[NET_CMD_ADDR] & 0xFF;
        if (cmd == 0) return;

        int bufferAddr = ((ram[NET_BUFFER_ADDR] & 0xFF) << 16) | 
                         ((ram[NET_BUFFER_ADDR+1] & 0xFF) << 8) | 
                         (ram[NET_BUFFER_ADDR+2] & 0xFF);

        if (cmd == 1) { 
            ram[NET_STATE_ADDR] = 1; 
            ram[NET_CMD_ADDR] = 0;
            isHost = true;
            new Thread(() -> {
                try {
                    serverSocket = new ServerSocket(2323);
                    ram[NET_STATE_ADDR] = 2; 
                    while (isHost && !serverSocket.isClosed() && poweredOn) {
                        Socket client = serverSocket.accept();
                        PrintWriter out = new PrintWriter(client.getOutputStream(), true);
                        hostClients.add(out);
                        BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream()));
                        
                        new Thread(() -> {
                            try {
                                String line;
                                while ((line = in.readLine()) != null && poweredOn) {
                                    incomingMessages.offer(line); 
                                    synchronized (hostClients) {
                                        for (PrintWriter peerOut : hostClients) {
                                            if (peerOut != out) peerOut.println(line);
                                        }
                                    }
                                }
                            } catch(Exception ignored) {}
                            hostClients.remove(out);
                        }).start();
                    }
                } catch(Exception e) { if (ram[NET_STATE_ADDR] == 1) ram[NET_STATE_ADDR] = 3; } 
            }).start();
        } 
        else if (cmd == 2) { 
            isHost = false;
            String target = readStringFromRam(ram, bufferAddr).trim();
            if (target.isEmpty()) target = "127.0.0.1";
            final String ip = target;
            ram[NET_STATE_ADDR] = 1; 
            ram[NET_CMD_ADDR] = 0;
            new Thread(() -> {
                try {
                    netSocket = new Socket(ip, 2323);
                    netOut = new PrintWriter(netSocket.getOutputStream(), true);
                    netIn = new BufferedReader(new InputStreamReader(netSocket.getInputStream()));
                    ram[NET_STATE_ADDR] = 2; 
                    new Thread(() -> {
                        try {
                            String line;
                            while ((line = netIn.readLine()) != null && poweredOn) incomingMessages.offer(line);
                        } catch(Exception ignored) {}
                        ram[NET_STATE_ADDR] = 0; 
                    }).start();
                } catch(Exception e) { ram[NET_STATE_ADDR] = 3; } 
            }).start();
        }
        else if (cmd == 3) { 
            String msg = readStringFromRam(ram, bufferAddr);
            if (isHost) {
                synchronized(hostClients) { for (PrintWriter o : hostClients) o.println(msg); }
            } else {
                if (netOut != null) netOut.println(msg);
            }
            ram[NET_CMD_ADDR] = 0;
        }
        else if (cmd == 4) { 
            String msg = incomingMessages.poll();
            if (msg != null) {
                byte[] bytes = (msg + "\n").getBytes(); 
                System.arraycopy(bytes, 0, ram, bufferAddr, Math.min(bytes.length, 500));
                ram[bufferAddr + Math.min(bytes.length, 500)] = 0;
                ram[NET_CMD_ADDR] = 1; 
            } else {
                ram[NET_CMD_ADDR] = 2; 
            }
        }
        else if (cmd == 5) { shutdown(ram); }
    }

    public void shutdown(byte[] ram) {
        try {
            isHost = false;
            if (serverSocket != null) serverSocket.close();
            if (netSocket != null) netSocket.close();
        } catch(Exception ignored) {}
        hostClients.clear();
        incomingMessages.clear();
        ram[NET_STATE_ADDR] = 0;
        ram[NET_CMD_ADDR] = 0;
    }

    private String readStringFromRam(byte[] ram, int addr) {
        StringBuilder sb = new StringBuilder();
        while (addr < ram.length && ram[addr] != 0 && sb.length() < 50) {
            sb.append((char)(ram[addr] & 0xFF));
            addr++;
        }
        return sb.toString();
    }
}