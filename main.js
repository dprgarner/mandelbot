'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');

const _  = require('underscore');
const qs = require('qs');
const Jimp = require('jimp');

const mandelbrot = require('./mandelbrot');

const PORT = 80;

function drawMandelbrot(mandelbrot, depth, cb) {
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

function api (req, res) {
  qs.parse(req.url.split('?')[0]);
  let params = _.extend({}, {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    depth: 100,
    scale: 1/128,
  }, qs.parse(req.url.split('?')[1]));

  params.width = parseInt(params.width);
  params.height = parseInt(params.height);
  params.depth = parseInt(params.depth);
  params.x = parseFloat(params.x);
  params.y = parseFloat(params.y);
  params.scale = parseFloat(params.scale);

  res.writeHead(200, {'Content-Type': 'image/png'});

  let startTime = Date.now();
  let set = mandelbrot(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    pipeImageTo(image, res);
  });
}

function pipeImageTo(image, dest) {
  image.getBuffer(Jimp.MIME_PNG, function (err, buffer) {
    if (err) return console.error(err);
    var s = new stream.PassThrough();
    s.end(buffer);
    s.pipe(dest);
  });
}

http.createServer((req, res) => {
  if (req.url.indexOf('/api') === 0) return api(req, res);

  if (req.url.indexOf('/elm.js') === 0) {
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    return fs.createReadStream('./elm.js').pipe(res);
  }

  res.writeHead(200, {'Content-Type': 'text/html'});
  fs.createReadStream('./index.html').pipe(res);
}).listen(PORT);

console.log(`Server listening on port ${PORT}`)