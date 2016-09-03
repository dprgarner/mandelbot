'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');

const _  = require('underscore');
const Jimp = require('jimp');
const qs = require('qs');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

const PORT = 80;

function pipeImageTo(image, dest) {
  image.getBuffer(Jimp.MIME_PNG, function (err, buffer) {
    if (err) return console.error(err);
    var s = new stream.PassThrough();
    s.end(buffer);
    s.pipe(dest);
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
  let set = constructSet(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    pipeImageTo(image, res);
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