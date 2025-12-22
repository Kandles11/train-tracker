const LED_WIDTH = 64;
const LED_HEIGHT = 128;
const SCALE = 8;

const canvas = document.getElementById("matrix");
canvas.width = LED_WIDTH * SCALE;
canvas.height = LED_HEIGHT * SCALE;

const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const bg = new Image();
bg.src = "sf-map.png";

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
    { route: "RED", progress: 0.0, speed: 0.02 },
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
  
function drawRoute(route) {
    const { path, color } = route;
    for (let i = 0; i < path.length - 1; i++) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];

    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);

    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
        drawPixel(x, y, color, 0.2);
        if (x !== x2) x += dx;
        if (y !== y2) y += dy;
    }
    }
}

function getPixelOnRoute(route, progress) {
    const pts = route.path;
    let lengths = [];
    let total = 0;
  
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i+1][0] - pts[i][0];
      const dy = pts[i+1][1] - pts[i][1];
      const len = Math.abs(dx) + Math.abs(dy);
      lengths.push(len);
      total += len;
    }
  
    let d = progress * total;
  
    for (let i = 0; i < lengths.length; i++) {
      if (d <= lengths[i]) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i+1];
        const t = d / lengths[i];
        return [
          Math.round(x1 + (x2 - x1) * t),
          Math.round(y1 + (y2 - y1) * t)
        ];
      }
      d -= lengths[i];
    }
  
    return pts[pts.length - 1];
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