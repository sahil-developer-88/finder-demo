import { useEffect, useRef } from 'react';

const StripeWaveCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const drawRibbon = (
      t: number,
      phaseX: number,
      phaseY: number,
      ampX: number,
      ampY: number,
      width: number,
      colors: [string, string, string, string]
    ) => {
      const w = W(), h = H();

      // Animate control points
      const cp1x = w * 0.25 + Math.sin(t * 0.8 + phaseX) * w * ampX;
      const cp1y = h * 0.25 + Math.cos(t * 0.6 + phaseY) * h * ampY;
      const cp2x = w * 0.75 + Math.cos(t * 0.7 + phaseX) * w * ampX;
      const cp2y = h * 0.65 + Math.sin(t * 0.9 + phaseY) * h * ampY;

      // Gradient along the ribbon
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0,    colors[0]);
      grad.addColorStop(0.35, colors[1]);
      grad.addColorStop(0.65, colors[2]);
      grad.addColorStop(1,    colors[3]);

      // Offset for ribbon thickness
      const dx = cp2y - cp1y;
      const dy = -(cp2x - cp1x);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = (dx / len) * width;
      const ny = (dy / len) * width;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, w, h);
      ctx.lineTo(w + nx, h + ny);
      ctx.bezierCurveTo(cp2x + nx, cp2y + ny, cp1x + nx, cp1y + ny, nx, ny);
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.fill();
    };

    const render = () => {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);

      // Ribbon 1 — main pink/orange (dominant, like Stripe)
      ctx.globalAlpha = 0.85;
      drawRibbon(t, 0, 0, 0.3, 0.2, h * 0.35,
        ['rgba(168,180,232,0.9)', 'rgba(240,56,160,1)', 'rgba(249,115,22,0.95)', 'rgba(245,166,35,0.9)']
      );

      // Ribbon 2 — magenta/amber (secondary)
      ctx.globalAlpha = 0.7;
      drawRibbon(t, 1.8, 2.4, 0.25, 0.25, h * 0.22,
        ['rgba(139,157,224,0.8)', 'rgba(232,40,154,0.95)', 'rgba(255,107,0,0.9)', 'rgba(245,166,35,0.85)']
      );

      // Ribbon 3 — soft highlight
      ctx.globalAlpha = 0.5;
      drawRibbon(t, 3.5, 1.2, 0.2, 0.3, h * 0.15,
        ['rgba(196,205,245,0.7)', 'rgba(244,114,182,0.85)', 'rgba(251,146,60,0.8)', 'rgba(253,186,116,0.7)']
      );

      ctx.globalAlpha = 1;
      t += 0.006;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

export default StripeWaveCanvas;
