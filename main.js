'use strict';

const fs = require('fs');
const http = require('http');

const _  = require('underscore');
const PNG = require('pngjs').PNG;
const qs = require('qs');

const mandelbrot = require('./mandelbrot');

const PORT = 80;

function createPng(params) {
  let startTime = Date.now();
  let set = mandelbrot(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  let width = params.width;
  let height = params.height;
  let cap = params.cap

  let png = new PNG({
    inputHasAlpha: false,
    deflateLevel: 0,
    width: width,
    height: height,
  });

  let min = cap;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (set[y][x] !== -1) 
        min = Math.min(min, set[y][x]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = (width * y + x) * 3;
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
  let params = _.extend({}, {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    cap: 100,
    scale: 1/128
  }, qs.parse(req.url.split('?')[1]));

  params.width = parseInt(params.width);
  params.height = parseInt(params.height);
  params.cap = parseInt(params.cap);
  params.x = parseFloat(params.x);
  params.y = parseFloat(params.y);
  params.scale = parseFloat(params.scale);

  res.writeHead(200, {'Content-Type': 'image/png'});
  createPng(params).pipe(res);
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