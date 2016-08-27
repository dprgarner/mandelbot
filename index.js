const http = require('http');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const mandelbrot = require('./mandelbrot');


http.createServer((req, res) => {
  let startTime = Date.now();
  let width = 250;
  let height = 250;
  let cap = 20;

  let set = mandelbrot(width, height, -0.5, 0, 0.01, cap);

  let png = new PNG({width, height});
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      let idx = (png.width * y + x) << 2;
      png.data[idx] = 0;
      png.data[idx+1] = Math.round((set[y][x] + 1) * 255 / (cap + 1));
      png.data[idx+2] = set[y][x] === -1 ? 0 : 255;
      png.data[idx+3] = 255;
    }
  }

  res.writeHead(200, {'Content-Type': 'image/png'});
  png
    .pack()
    .pipe(res)
    .once('finish', function () {
      console.log(`PNG outputted after ${Date.now() - startTime}ms`);
    });
}).listen(80);