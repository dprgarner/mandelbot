'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');
const url = require('url');

const _  = require('underscore');
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');
const CombinedStream = require('combined-stream');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

const PORT = 80;

function pipeImageTo(image, dest) {
  image.getBuffer(Jimp.MIME_PNG, function (err, buffer) {
    if (err) return console.error(err);
    let s = new stream.PassThrough();
    s.end(buffer);
    s.pipe(dest);
  });
}

function getParamsWithDefault(queryDict) {
  let params = _.extend({}, {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    depth: 100,
    scale: 1/128,
  }, queryDict);

  params.width = parseInt(params.width);
  params.height = parseInt(params.height);
  params.depth = parseInt(params.depth);
  params.x = parseFloat(params.x);
  params.y = parseFloat(params.y);
  params.scale = parseFloat(params.scale);

  return params;
}

function apiPng(queryDict, res) {
  let params = getParamsWithDefault(queryDict);

  res.writeHead(200, {'Content-Type': 'image/png'});
  let startTime = Date.now();
  let set = constructSet(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    pipeImageTo(image, res);
  });
}

function apiGif(queryDict, res) {
  let startTime = Date.now();
  let params = getParamsWithDefault(queryDict);
  let set = constructSet(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    console.log(`Drawn after ${Date.now() - startTime}ms`);
    let combined = CombinedStream.create();

    let power = Math.exp(Math.log(2) / 30);
    console.log(power);
    for (var i = 0; i < 30; i++) {
      let image2 = image.clone();
      let newSize = Math.floor(params.width * Math.pow(power, i));
      image2.resize(newSize, Jimp.AUTO);
      image2.crop(0, 0, params.width, params.height);

      let s = new stream.PassThrough();
      s.end(image2.bitmap.data);
      combined.append(s);
      console.log(`Drawn frame ${i} after ${Date.now() - startTime}ms`);
    }

    res.writeHead(200, {'Content-Type': 'image/gif'});
    let encoder = new GIFEncoder(params.width, params.height);

    combined.pipe(encoder.createWriteStream({repeat: 0, delay: 0}))
    .pipe(res)
    .on('finish', function () {
      console.log(`Rendered after ${Date.now() - startTime}ms`);
    })
  });
}

// Server
http.createServer((req, res) => {
  function serveStatic(res, contentType, filePath) {
    res.writeHead(200, {'Content-Type': contentType});
    fs.createReadStream(filePath).pipe(res);
  }

  let reqDict = url.parse(req.url, true);

  switch (reqDict.pathname) {
    case '/png/':
      return apiPng(reqDict.query, res);
    case '/gif/':
      return apiGif(reqDict.query, res);
    case '/elm.js':
      return serveStatic(res, 'text/javascript', './elm.js');
    case '/style.css':
      return serveStatic(res, 'text/css', './style.css');
    default:
      return serveStatic(res, 'text/html', './index.html');
  }
}).listen(PORT);

console.log(`Server listening on port ${PORT}`)