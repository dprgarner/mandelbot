const fs = require('fs');
const http = require('http');

const PNG = require('pngjs').PNG;
const qs = require('qs');

const mandelbrot = require('./mandelbrot');

function createPng(width, height, centerX, centerY, scale, cap) {
  let startTime = Date.now();
  let set = mandelbrot(width, height, centerX, centerY, scale, cap);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  let png = new PNG({
    inputHasAlpha: false,
    deflateLevel: 0,
    width, height,
  });

  let min = cap;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++)
      if (set[y][x] !== -1) 
        min = Math.min(min, set[y][x]);

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      let idx = (png.width * y + x) * 3;
      if (set[y][x] === -1) {
        png.data[idx] = png.data[idx+1] = png.data[idx+2] = 0;
        continue;
      }

      png.data[idx] = Math.max(0, Math.min(255, Math.round(255 * Math.log(1.5 * (set[y][x] - min)) / Math.log(cap))));
      png.data[idx+1] = png.data[idx];
      png.data[idx+2] = 255 - png.data[idx];
    }
  }

  return png.pack();
}

function api (req, res) {
  qs.parse(req.url.split('?')[0]);
  let params = qs.parse(req.url.split('?')[1]);
  var {
    width=600,
    height=600,
    x=-0.5,
    y=0,
    cap=100,
    scale=1/250
  } = params;
  width = parseInt(width);
  height = parseInt(height);
  cap = parseInt(cap);
  x = parseFloat(x);
  y = parseFloat(y);
  scale = parseFloat(scale);

  res.writeHead(200, {'Content-Type': 'image/png'});
  createPng(width, height, x, y, scale, cap).pipe(res);
}

http.createServer((req, res) => {
  if (req.url.indexOf('/api') === 0) return api(req, res);

  res.writeHead(200, {'Content-Type': 'text/html'});
  fs.createReadStream('./index.html').pipe(res);
}).listen(80);