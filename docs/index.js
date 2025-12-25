const LED_WIDTH = 64;
const LED_HEIGHT = 128;
// TEMP: use a larger scale so the low-res grid is easier to align visually.
const SCALE = 16;
const SHOW_LABELS = true;

const canvas = document.getElementById("matrix");
canvas.width = LED_WIDTH * SCALE;
canvas.height = LED_HEIGHT * SCALE;

const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const bg = new Image();
bg.src = "map-north.png";

bg.onload = () => {
    console.log("bg loaded");
  ctx.drawImage(
    bg,
    0,
    0,
    LED_WIDTH * SCALE,
    LED_HEIGHT * SCALE
  );
};

let trains = [
    { route: "RED", progress: 0.0, speed: 0.001 },
    { route: "BLUE", progress: 0.5, speed: 0.01 }
  ];

function drawPixel(x, y, [r, g, b], alpha = 1.0) {
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(
      x * SCALE,
      (LED_HEIGHT - 1 - y) * SCALE,  // flip Y for LED-style coords
      SCALE,
      SCALE
    );
  }
  
// Build a per-pixel path for a route using the exact same stepping
// logic as the line renderer. This is the single source of truth for
// both drawing and train movement.
function buildRoutePixels(route) {
    const pixels = [];
    const { path } = route;

    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i];
      const [x2, y2] = path[i + 1];

      const dx = Math.sign(x2 - x1);
      const dy = Math.sign(y2 - y1);

      let x = x1;
      let y = y1;

      // walk from (x1, y1) up to and including (x2, y2)
      while (true) {
        pixels.push([x, y]);
        if (x === x2 && y === y2) break;
        if (x !== x2) x += dx;
        if (y !== y2) y += dy;
      }
    }

    return pixels;
}

function getRoutePixels(route) {
    if (!route._pixels) {
      route._pixels = buildRoutePixels(route);
    }
    return route._pixels;
}

function drawRoute(route) {
    const pixels = getRoutePixels(route);
    for (const [x, y] of pixels) {
      drawPixel(x, y, route.color, 0.2);
    }
}

function drawStationLabels() {
    if (!SHOW_LABELS) return;
    ctx.save();
    const fontSize = Math.max(10, Math.floor(SCALE * 0.9));
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = "yellow";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    for (const s of STATIONS) {
      const screenX = s.x * SCALE;
      const screenY = (LED_HEIGHT - 1 - s.y) * SCALE;
      const label = s.code || s.name;
      // slight offset so text doesn't sit directly on the dot
      const lx = screenX + SCALE * 0.6;
      const ly = screenY - SCALE * 0.3;
      ctx.strokeText(label, lx, ly);
      ctx.fillText(label, lx, ly);
    }

    ctx.restore();
}

function getPixelOnRoute(route, progress) {
    const pixels = getRoutePixels(route);
    if (pixels.length === 0) {
      return route.path[0];
    }

    const idx = Math.floor(progress * pixels.length) % pixels.length;
    return pixels[idx];
}


  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // draw background image
    if (bg.complete && bg.naturalHeight !== 0) {
      ctx.drawImage(
        bg,
        0,
        0,
        LED_WIDTH * SCALE,
        LED_HEIGHT * SCALE
      );
    }
  
    // draw routes
    for (const r of Object.values(routes)) {
      drawRoute(r);
    }

    for (const s of STATIONS) {
      drawPixel(s.x, s.y, [200,200,200]); // station dot
    }
    drawStationLabels();
  
    // update + draw trains
    for (const t of trains) {
      t.progress = (t.progress + t.speed) % 1.0;
      const route = routes[t.route];
      const [x, y] = getPixelOnRoute(route, t.progress);
      drawPixel(x, y, route.color, 1.0);
    }
  
    requestAnimationFrame(loop);
  }
  
  loop();