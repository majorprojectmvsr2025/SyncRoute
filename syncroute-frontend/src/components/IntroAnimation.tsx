import { useEffect, useRef, useState, useCallback } from 'react';

// --- Utility Functions ---
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

// --- Types & Interfaces ---
interface IntroAnimationProps {
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  active: boolean;
}

interface CarState {
  x: number;
  y: number;
  baseY: number;
  speed: number;
  passengers: 1 | 2 | 3;
  alpha: number;
  lane: 'left' | 'center' | 'right';
  targetLane: 'center';
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  road: string;
  roadMark: string;
  building: string;
  windowLit: string;
  smoke: string;
  carBody: string;
  carGlass: string;
}

const DARK_PALETTE: Palette = {
  skyTop: '#0b0e1a', skyBottom: '#1a1f35', ground: '#0c0c0c',
  road: '#1e1e1e', roadMark: 'rgba(255,255,255,0.2)', building: '#131725',
  windowLit: 'rgba(255,235,120,0.8)', smoke: '180,185,190',
  carBody: '#d9d9d9', carGlass: 'rgba(140,190,230,0.55)'
};

const LIGHT_PALETTE: Palette = {
  skyTop: '#d0dcec', skyBottom: '#b8c8de', ground: '#a0aec0',
  road: '#7a8290', roadMark: 'rgba(255,255,255,0.6)', building: '#9aa4b8',
  windowLit: 'rgba(255,225,90,0.9)', smoke: '100,105,110',
  carBody: '#2e2e2e', carGlass: 'rgba(70,120,190,0.6)'
};

export default function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [containerOpacity, setContainerOpacity] = useState(1);
  const [isDark, setIsDark] = useState(true);

  // Pre-rendered canvases
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const carCanvasesRef = useRef<Record<number, HTMLCanvasElement>>({});

  // Detect theme
  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // --- Rendering Helpers ---
  const makeCar = useCallback((carHeight: number, dark: boolean, passengerCount: 1 | 2 | 3) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const carWidth = carHeight * 2.4;
    canvas.width = carWidth;
    canvas.height = carHeight * 1.5; // Extra space for shadow

    const pal = dark ? DARK_PALETTE : LIGHT_PALETTE;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(carWidth / 2, carHeight + 2, carWidth / 2.2, carHeight / 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = pal.carBody;
    ctx.beginPath();
    ctx.moveTo(carWidth * 0.1, carHeight);
    ctx.lineTo(carWidth * 0.9, carHeight);
    ctx.lineTo(carWidth * 0.95, carHeight * 0.6); // Hood
    ctx.lineTo(carWidth * 0.7, carHeight * 0.5);  // Windshield bottom
    ctx.lineTo(carWidth * 0.6, carHeight * 0.1);  // Roof front
    ctx.lineTo(carWidth * 0.3, carHeight * 0.1);  // Roof back
    ctx.lineTo(carWidth * 0.15, carHeight * 0.5); // Rear window bottom
    ctx.lineTo(carWidth * 0.05, carHeight * 0.6); // Trunk
    ctx.closePath();
    ctx.fill();

    // Windows
    ctx.fillStyle = pal.carGlass;
    ctx.beginPath();
    ctx.moveTo(carWidth * 0.32, carHeight * 0.15);
    ctx.lineTo(carWidth * 0.58, carHeight * 0.15);
    ctx.lineTo(carWidth * 0.65, carHeight * 0.5);
    ctx.lineTo(carWidth * 0.2, carHeight * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // B-Pillar
    ctx.strokeStyle = pal.carBody;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(carWidth * 0.45, carHeight * 0.15);
    ctx.lineTo(carWidth * 0.45, carHeight * 0.5);
    ctx.stroke();

    // Passengers (Silhouettes)
    ctx.fillStyle = dark ? '#000' : '#fff';
    const drawPassenger = (x: number) => {
      ctx.beginPath();
      ctx.arc(carWidth * x, carHeight * 0.35, carHeight * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(carWidth * x, carHeight * 0.6, carHeight * 0.18, Math.PI, Math.PI * 2);
      ctx.fill();
    };

    if (passengerCount >= 1) drawPassenger(0.55); // Driver
    if (passengerCount >= 2) drawPassenger(0.35); // Back seat left
    if (passengerCount === 3) drawPassenger(0.25); // Back seat right

    // Lights
    ctx.fillStyle = '#ff3333'; // Taillight
    ctx.fillRect(carWidth * 0.05, carHeight * 0.6, 6, 8);
    ctx.fillStyle = '#ffebb3'; // Headlight
    ctx.beginPath();
    ctx.moveTo(carWidth * 0.95, carHeight * 0.6);
    ctx.lineTo(carWidth * 0.95, carHeight * 0.75);
    ctx.lineTo(carWidth * 0.9, carHeight * 0.7);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#111';
    const drawWheel = (x: number) => {
      ctx.beginPath();
      ctx.arc(carWidth * x, carHeight, carHeight * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(carWidth * x, carHeight, carHeight * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
    };
    drawWheel(0.2);
    drawWheel(0.8);

    return canvas;
  }, []);

  const buildBackground = useCallback((width: number, height: number, dark: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const pal = dark ? DARK_PALETTE : LIGHT_PALETTE;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.64);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.64);

    // Sun/Moon
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.8)' : 'rgba(255, 230, 150, 0.9)';
    ctx.shadowColor = dark ? '#fff' : '#ffe696';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.2, height * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Buildings (Far Layer)
    ctx.fillStyle = pal.building;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < width; i += 60) {
      const bHeight = height * (0.2 + Math.random() * 0.2);
      ctx.fillRect(i, height * 0.64 - bHeight, 55, bHeight);
    }

    // Buildings (Near Layer)
    ctx.globalAlpha = 1.0;
    for (let i = -20; i < width; i += 80) {
      const bHeight = height * (0.15 + Math.random() * 0.3);
      ctx.fillRect(i, height * 0.64 - bHeight, 70, bHeight);
      
      // Windows
      if (Math.random() > 0.3) {
        ctx.fillStyle = pal.windowLit;
        for (let wy = height * 0.64 - bHeight + 10; wy < height * 0.64 - 20; wy += 20) {
          if (Math.random() > 0.5) ctx.fillRect(i + 15, wy, 10, 10);
          if (Math.random() > 0.5) ctx.fillRect(i + 45, wy, 10, 10);
        }
        ctx.fillStyle = pal.building;
      }
    }

    // Ground
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, height * 0.64, width, height * 0.36);

    // Road Base
    const roadY = height * 0.64;
    const roadH = height * 0.14;
    ctx.fillStyle = pal.road;
    ctx.fillRect(0, roadY, width, roadH);
    
    // Road Edges
    ctx.strokeStyle = pal.roadMark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, roadY); ctx.lineTo(width, roadY);
    ctx.moveTo(0, roadY + roadH); ctx.lineTo(width, roadY + roadH);
    ctx.stroke();

    return canvas;
  }, []);

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = canvas.width;
    let height = canvas.height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      bgCanvasRef.current = buildBackground(width, height, isDark);
      
      const carHeight = Math.max(20, height * 0.035);
      carCanvasesRef.current = {
        1: makeCar(carHeight, isDark, 1),
        2: makeCar(carHeight, isDark, 2),
        3: makeCar(carHeight, isDark, 3)
      };
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initial State
    const roadY = height * 0.64;
    const laneHeight = (height * 0.14) / 3;
    const carH = Math.max(20, height * 0.035);
    const carW = carH * 2.4;

    const cars: CarState[] = [
      { x: width * 0.15, y: roadY + laneHeight * 0.5, baseY: roadY + laneHeight * 0.5, speed: 1.2, passengers: 1, alpha: 1, lane: 'left', targetLane: 'center' },
      { x: width * 0.45, y: roadY + laneHeight * 1.5, baseY: roadY + laneHeight * 1.5, speed: 1.0, passengers: 1, alpha: 1, lane: 'center', targetLane: 'center' },
      { x: width * 0.75, y: roadY + laneHeight * 2.5, baseY: roadY + laneHeight * 2.5, speed: 1.3, passengers: 1, alpha: 1, lane: 'right', targetLane: 'center' }
    ];

    const particles: Particle[] = [];
    let roadScroll = 0;

    const spawnSmoke = (carX: number, carY: number, amount: number) => {
      for (let i = 0; i < amount; i++) {
        particles.push({
          x: carX - carW * 0.3,
          y: carY + carH * 0.8,
          vx: -1.5 - Math.random() * 1.5,
          vy: -0.3 + Math.random() * 0.6,
          radius: 3 + Math.random() * 5,
          alpha: 0.7,
          active: true
        });
      }
    };

    const drawFrame = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;

      ctx.clearRect(0, 0, width, height);
      if (bgCanvasRef.current) ctx.drawImage(bgCanvasRef.current, 0, 0);

      // Scroll Background Elements
      roadScroll = (roadScroll + 5) % 100;
      
      // Draw Road Dashes
      ctx.strokeStyle = isDark ? DARK_PALETTE.roadMark : LIGHT_PALETTE.roadMark;
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 30]);
      ctx.beginPath();
      ctx.moveTo(-roadScroll, roadY + laneHeight); ctx.lineTo(width, roadY + laneHeight);
      ctx.moveTo(-roadScroll, roadY + laneHeight * 2); ctx.lineTo(width, roadY + laneHeight * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Street Lamps
      const lampSpacing = 260;
      const scrollOffset = (elapsed * 0.2) % lampSpacing;
      for (let i = -lampSpacing; i < width + lampSpacing; i += lampSpacing) {
        const lx = i - scrollOffset;
        ctx.fillStyle = isDark ? '#222' : '#555';
        ctx.fillRect(lx, roadY - 40, 4, 40); // Pole
        ctx.fillStyle = isDark ? '#ffebb3' : '#fff5cc';
        ctx.beginPath();
        ctx.arc(lx + 2, roadY - 40, 6, 0, Math.PI * 2); // Bulb
        ctx.fill();
        
        // Light cone
        const grad = ctx.createLinearGradient(lx, roadY - 40, lx, roadY + 20);
        grad.addColorStop(0, isDark ? 'rgba(255,235,179,0.4)' : 'rgba(255,245,204,0.6)');
        grad.addColorStop(1, 'rgba(255,235,179,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(lx + 2, roadY - 40);
        ctx.lineTo(lx - 40, roadY + 20);
        ctx.lineTo(lx + 44, roadY + 20);
        ctx.fill();
      }

      // Phase Logic Updates
      if (elapsed < 4000) {
        if (phase !== 1) setPhase(1);
        cars.forEach((car, i) => {
          // Slower, more realistic traffic movement with slight variations
          car.x += car.speed * (0.5 + 0.2 * Math.sin(elapsed * 0.002 + i));
          if (car.x > width + 100) car.x = -100;
          // More smoke for traffic
          if (elapsed % (i === 1 ? 12 : 6) < 16) spawnSmoke(car.x, car.y, 3);
        });
      } 
      else if (elapsed >= 4000 && elapsed < 6500) {
        if (phase !== 2) setPhase(2);
        const p = clamp((elapsed - 4000) / 2500, 0, 1);
        const easeP = easeInOutCubic(p);

        // Smooth lane merging
        cars[0].y = lerp(cars[0].baseY, cars[1].baseY, easeP);
        cars[2].y = lerp(cars[2].baseY, cars[1].baseY, easeP);
        
        // Horizontal bunching - cars come together
        cars[0].x = lerp(cars[0].x, cars[1].x - 50, easeP * 0.3);
        cars[2].x = lerp(cars[2].x, cars[1].x + 50, easeP * 0.3);

        // Fade out merging cars
        cars[0].alpha = 1 - easeP;
        cars[2].alpha = 1 - easeP;

        // Add passengers to center car
        if (p > 0.3 && cars[1].passengers === 1) cars[1].passengers = 2;
        if (p > 0.7 && cars[1].passengers === 2) cars[1].passengers = 3;

        // Center car continues moving
        cars[1].x += cars[1].speed * 1.2;
        if (cars[1].x > width + 100) cars[1].x = -100;
        
        // Less smoke as cars merge
        if (elapsed % 25 < 16) spawnSmoke(cars[1].x, cars[1].y, 1);
      } 
      else if (elapsed >= 6500 && elapsed < 8500) {
        if (phase !== 3) setPhase(3);
        // Carpooling car moves faster and smoother
        cars[1].x += cars[1].speed * 1.8;
        if (cars[1].x > width + 100) cars[1].x = -100;
        // Minimal smoke
        if (elapsed % 40 < 16) spawnSmoke(cars[1].x, cars[1].y, 1);

        const fadeP = clamp((elapsed - 6500) / 2000, 0, 1);
        setContainerOpacity(1 - easeInOutCubic(fadeP));
      } 
      else if (elapsed >= 8500) {
        onComplete();
        return; // End loop
      }

      // Draw Particles
      const smokeRgb = isDark ? DARK_PALETTE.smoke : LIGHT_PALETTE.smoke;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.2;
        p.alpha -= 0.01;
        
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(${smokeRgb}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Cars
      // Sort by Y so bottom lane renders on top
      const sortedCars = [...cars].sort((a, b) => a.y - b.y);
      sortedCars.forEach(car => {
        if (car.alpha <= 0.01) return;
        ctx.globalAlpha = car.alpha;
        const carImg = carCanvasesRef.current[car.passengers];
        if (carImg) {
          // Centered drawing based on image dimensions
          ctx.drawImage(carImg, car.x, car.y - carImg.height * 0.6);
        }
        ctx.globalAlpha = 1.0;
      });

      requestRef.current = requestAnimationFrame(drawFrame);
    };

    requestRef.current = requestAnimationFrame(drawFrame);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isDark, makeCar, buildBackground, onComplete, phase]);

  // --- UI Data ---
  const textContent = {
    1: { title: "3 cars. 3 drivers. Heavy traffic.", sub: "Each car carries just one person — wasting fuel and clogging roads." },
    2: { title: "One car. Three passengers. Same destination.", sub: "Share the ride — reduce emissions by 75%." },
    3: { title: "SyncRoute: Smarter commutes for everyone.", sub: "Route-matched carpooling that saves money and the planet." }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden transition-opacity duration-100 ${isDark ? 'bg-[#0b0e1a]' : 'bg-[#d0dcec]'}`}
      style={{ opacity: containerOpacity }}
    >
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full block pointer-events-none" 
      />

      {/* Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      {/* Text Content Overlay */}
      <div className="absolute top-[20%] left-0 w-full flex flex-col items-center justify-center text-center px-4 pointer-events-none">
        <div key={`title-${phase}`} className="animate-fade-in-up">
          <h1 className={`text-3xl md:text-5xl font-bold mb-4 tracking-tight drop-shadow-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {textContent[phase].title}
          </h1>
          <p className={`text-lg md:text-2xl font-medium drop-shadow-md ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {textContent[phase].sub}
          </p>
        </div>
      </div>

      {/* Progress Dots & Skip Button */}
      <div className="absolute bottom-8 left-0 w-full flex items-center justify-between px-8 md:px-16">
        <div className="flex gap-3">
          {[1, 2, 3].map((step) => (
            <div 
              key={step} 
              className={`h-2 rounded-full transition-all duration-500 ${
                phase === step 
                  ? `w-8 ${isDark ? 'bg-white' : 'bg-slate-800'}` 
                  : `w-2 ${isDark ? 'bg-white/30' : 'bg-slate-800/30'}`
              }`}
            />
          ))}
        </div>
        <button 
          onClick={onComplete}
          className={`px-5 py-2 rounded-full font-semibold text-sm transition-colors ${
            isDark 
              ? 'bg-white/10 hover:bg-white/20 text-white' 
              : 'bg-slate-800/10 hover:bg-slate-800/20 text-slate-800'
          }`}
        >
          Skip Intro
        </button>
      </div>

      {/* Embedded CSS for simple animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}