import { useEffect, useRef, useState } from 'react';
import { Machine } from './hardware/Machine';
import { ATTR_ADDR, FONT_ADDR, TEXT_ADDR, CURSOR_X_ADDR, CURSOR_Y_ADDR } from './hardware/constants';

const osFilesRaw = import.meta.glob('/os/*.asm', { query: '?raw', import: 'default' });

const PALETTE = [
  "#000000", "#0000AA", "#00AA00", "#00AAAA",
  "#AA0000", "#AA00AA", "#AA5500", "#AAAAAA",
  "#555555", "#5555FF", "#55FF55", "#55FFFF",
  "#FF5555", "#FF55FF", "#FFFF55", "#FFFFFF"
];

const PALETTE_RGB = PALETTE.map(hex => {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
});

function GPUCanvas({ machine }: { machine: Machine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animId: number;
    let cursorVisible = true;
    let lastCursorToggle = Date.now();

    const imageData = ctx.createImageData(320, 200);
    const data = imageData.data;

    const render = () => {
      const ram = machine.ram;
      
      for (let y = 0; y < 25; y++) {
        for (let x = 0; x < 40; x++) {
          const offset = y * 40 + x;
          const charIdx = ram[TEXT_ADDR + offset] & 0xFF;
          const colorAttr = ram[ATTR_ADDR + offset] & 0xFF;
          
          const fg = PALETTE_RGB[colorAttr & 0x0F];
          const bg = PALETTE_RGB[(colorAttr >> 4) & 0x0F];
          
          const baseX = x * 8;
          const baseY = y * 8;
          
          for (let row = 0; row < 8; row++) {
            const py = baseY + row;
            if (py >= 200) continue;
            for (let col = 0; col < 8; col++) {
              if (baseX + col < 320) {
                const pIdx = (py * 320 + baseX + col) * 4;
                data[pIdx] = bg.r;
                data[pIdx + 1] = bg.g;
                data[pIdx + 2] = bg.b;
                data[pIdx + 3] = 255;
              }
            }
          }

          if (charIdx !== 0xFF && charIdx !== 0x00 && charIdx !== 0x20) {
            const fontAddr = FONT_ADDR + (charIdx * 8);
            for (let row = 0; row < 8; row++) {
              const line = ram[fontAddr + row] & 0xFF;
              if (line === 0) continue;
              const py = baseY + row;
              if (py >= 200) continue;
              for (let col = 0; col < 8; col++) {
                if (((line >> (7 - col)) & 1) === 1 && baseX + col < 320) {
                  const pIdx = (py * 320 + baseX + col) * 4;
                  data[pIdx] = fg.r;
                  data[pIdx + 1] = fg.g;
                  data[pIdx + 2] = fg.b;
                }
              }
            }
          }
        }
      }

      const now = Date.now();
      if (now - lastCursorToggle > 500) {
        cursorVisible = !cursorVisible;
        lastCursorToggle = now;
      }

      if (cursorVisible && machine.poweredOn) {
        let cx = ram[CURSOR_X_ADDR] & 0xFF;
        let cy = ram[CURSOR_Y_ADDR] & 0xFF;
        cx = Math.max(0, Math.min(39, cx));
        cy = Math.max(0, Math.min(24, cy));
        
        const colorAttr = ram[ATTR_ADDR + (cy * 40 + cx)] & 0xFF;
        const fg = PALETTE_RGB[colorAttr & 0x0F];
        
        const py = cy * 8 + 7;
        if (py < 200) {
          for (let col = 0; col < 8; col++) {
            if (cx * 8 + col < 320) {
              const pIdx = (py * 320 + cx * 8 + col) * 4;
              data[pIdx] = fg.r;
              data[pIdx + 1] = fg.g;
              data[pIdx + 2] = fg.b;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [machine]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 320;
    let y = ((e.clientY - rect.top) / rect.height) * 200;
    x = Math.max(0, Math.min(319, Math.floor(x)));
    y = Math.max(0, Math.min(199, Math.floor(y)));
    return { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    machine.handleMouseEvent(x, y, 0, true);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    let btn = 1;
    if (e.button === 1) btn = 3;
    if (e.button === 2) btn = 2;
    machine.handleMouseEvent(x, y, btn, false);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    machine.handleMouseEvent(x, y, 0, false);
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={320} 
      height={200} 
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className="w-[640px] h-[400px] border-4 border-gray-800 rounded shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function DiagnosticsPanel({ machine }: { machine: Machine }) {
  const [regs, setRegs] = useState({ r0: 0, r1: 0, r2: 0, r3: 0, pc: 0 });

  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;
    
    const loop = (time: number) => {
      if (time - lastUpdate > 100) { // Update ~10 times per second
        setRegs({
          r0: machine.cpu.registers[0],
          r1: machine.cpu.registers[1],
          r2: machine.cpu.registers[2],
          r3: machine.cpu.registers[3],
          pc: machine.cpu.getPC(),
        });
        lastUpdate = time;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [machine]);

  const hex = (n: number) => n.toString(16).toUpperCase().padStart(6, '0');

  return (
    <div className="bg-gray-800 p-6 rounded-lg text-gray-300">
      <h2 className="text-xl font-semibold mb-4 text-white font-sans">CPU Diagnostics</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-black p-4 rounded text-sm font-mono text-center">
        <div>
          <div className="text-gray-500 mb-1">AX (R0)</div>
          <div className="text-green-400">0x{hex(regs.r0)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">BX (R1)</div>
          <div className="text-green-400">0x{hex(regs.r1)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">CX (R2)</div>
          <div className="text-green-400">0x{hex(regs.r2)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">DX (R3)</div>
          <div className="text-green-400">0x{hex(regs.r3)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">PC</div>
          <div className="text-yellow-400">0x{hex(regs.pc)}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [machine] = useState(() => new Machine());
  const [poweredOn, setPoweredOn] = useState(false);
  const [osFiles, setOsFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadOs() {
      const files: Record<string, string> = {};
      for (const [path, resolver] of Object.entries(osFilesRaw)) {
        const content = await resolver();
        const name = path.split('/').pop()!;
        files[name] = content as string;
      }
      setOsFiles(files);
    }
    loadOs();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 's' || e.key === 'x')) || e.key === 'Backspace' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
      }
      machine.handleKeyPress(e.keyCode, e.key, e.ctrlKey);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [machine]);

  const handlePowerOn = async () => {
    await machine.powerOn(osFiles);
    setPoweredOn(true);
  };

  const handlePowerOff = () => {
    machine.powerOff();
    setPoweredOn(false);
  };

  const handleReboot = () => {
    machine.reboot(osFiles);
  };

  const handleExportDisk = () => {
    const saved = localStorage.getItem("iron_disk_img");
    if (!saved) {
      alert("No disk image found to export.");
      return;
    }
    const decoded = atob(saved);
    const arr = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) arr[i] = decoded.charCodeAt(i);
    
    const blob = new Blob([arr], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "iron_disk.img";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDisk = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.img';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const buf = await file.arrayBuffer();
      const arr = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
      localStorage.setItem("iron_disk_img", btoa(binary));
      alert("Disk image imported successfully! Please reset the VM.");
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center py-10 font-sans text-gray-200 select-none">
      <div className="w-full max-w-4xl mx-auto px-4">
        
        <header className="mb-6 flex justify-between items-end border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">JavaOS Iron Web</h1>
            <p className="text-gray-400 mt-1">v14.00 Modular Virtual Machine</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleImportDisk}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded shadow transition text-sm flex items-center"
            >
              Import Disk
            </button>
            <button 
              onClick={handleExportDisk}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded shadow transition text-sm flex items-center mr-4"
            >
              Export Disk
            </button>
            {!poweredOn ? (
              <button 
                onClick={handlePowerOn}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded shadow transition"
              >
                Power On
              </button>
            ) : (
              <>
                <button 
                  onClick={handleReboot}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded shadow transition"
                >
                  Reset
                </button>
                <button 
                  onClick={handlePowerOff}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded shadow transition"
                >
                  Power Off
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex justify-center my-10 relative">
          <div className="bg-black p-2 rounded-xl">
            <GPUCanvas machine={machine} />
          </div>
        </main>
        
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DiagnosticsPanel machine={machine} />
          
          <div className="bg-gray-800 p-6 rounded-lg text-gray-300">
            <h2 className="text-xl font-semibold mb-4 text-white">System Logs</h2>
            <div className="bg-black p-4 rounded h-48 overflow-y-auto font-mono text-sm">
              <p className="text-green-400">System Ready.</p>
              <p className="text-gray-500">Loaded {Object.keys(osFiles).length} OS modules from /os directory.</p>
              <p className="text-gray-500">Hardware KVM Mouse is active (IRQ 2).</p>
              <p className="text-yellow-400">Disk state is preserved in localStorage.</p>
              {machine.cpu.isPanic() && (
                <p className="text-red-500 font-bold mt-2">
                  [CRASH] {machine.cpu.getPanicCode()} at PC: 0x{machine.cpu.getPC().toString(16).toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
