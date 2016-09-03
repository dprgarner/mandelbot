'use strict';

const Jimp = require('jimp');

function convergesWithin(depth, x, y) {
  // z -> z^2 + c
  // or: x_0 = x, y_0 = y, c = x_0 + iy_0
  // 
  // x_(n+1) + iy_(n+1) 
  // = (x_n + iy_n)^2 + x_0 + iy_0
  // = (x_n^2 - y_n^2 + x_0) + i(2*x_n*y_n + y_0)

  let iterX = x, iterY = y;
  let newX, newY;
  for (let i = 0; i < depth; i++) {
    newX = iterX * iterX - iterY * iterY + x;
    newY = 2 * iterX * iterY + y;
    if (newX * newX + newY * newY > 4) return i;
    iterX = newX;
    iterY = newY;
  }
  return -1;
}

exports.constructSet = function(params) {
  let width = params.width;
  let height = params.height;
  let centerX = params.x;
  let centerY = params.y;
  let scale = params.scale;
  let depth = params.depth;

  let set = [];
  let startX = centerX - scale * width / 2;
  let startY = centerY + scale * height / 2;
  for (let y = 0; y < height; y++) {
    set[y] = [];
    for (let x = 0; x < width; x++) {
      set[y][x] = convergesWithin(depth, startX + scale * x, startY - scale * y);
    }
  }
  return set;
}

exports.drawMandelbrot = function(mandelbrot, depth, cb) {
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;

  let min = depth;
  let d = Date.now();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x] !== -1)
        min = Math.min(min, mandelbrot[y][x]);

  var image = new Jimp(width, height, 0x000000ff, function (err, image) {
    if (err) return console.error(err);

    image.scan(0, 0, width, height, function (x, y, idx) {
      let iterations = mandelbrot[y][x];
      if (iterations === -1) return;
      this.bitmap.data[idx] = Math.max(0, Math.min(255, Math.round(255 * Math.log(1.5 * (iterations - min)) / Math.log(depth))));
      this.bitmap.data[idx+1] = this.bitmap.data[idx];
      this.bitmap.data[idx+2] = 255 - this.bitmap.data[idx];
    });

    cb(null, image);
  });
}