const fs = require('fs');
const http = require('http');

const PNG = require('pngjs').PNG;
const qs = require('qs');

const mandelbrot = require('./mandelbrot');

function createPng(width, height, startX, startY, scale, cap) {
  let set = mandelbrot(width, height, startX, startY, scale, cap);

  let scalar = 255 / (cap + 1);
  let png = new PNG({
    inputHasAlpha: false,
    deflateLevel: 0,
    width, height,
  });

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      let idx = (png.width * y + x) * 3;
      png.data[idx] = Math.round((set[y][x] + 1) * scalar);
      png.data[idx+1] = png.data[idx];
      png.data[idx+2] = set[y][x] === -1 ? 0 : 255;
    }
  }

  return png.pack();
}

http.createServer((req, res) => {
  let startTime = Date.now();

  let params = qs.parse(req.url.split('?')[1]);
  var {
    width=600,
    height=600,
    startX=-0.5,
    startY=0,
    cap=32,
    scale=1/250
  } = params;
  width = parseInt(width);
  height = parseInt(height);
  cap = parseInt(cap);
  startX = parseFloat(startX);
  startY = parseFloat(startY);
  scale = parseFloat(scale);

  // Eg: // /?cap=256&startX=-0.738531&startY=0.24&scale=0.00001

  res.writeHead(200, {'Content-Type': 'image/png'});
  createPng(width, height, startX, startY, scale, cap)
    .pipe(res)
    .once('finish', function () {
      console.log(`PNG outputted after ${Date.now() - startTime}ms`);
    });
}).listen(80);