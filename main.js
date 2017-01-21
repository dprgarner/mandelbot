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
  let params = {
    width: 450,
    height: 300,
    // x: 0.5,
    // y: 0,
    x: -0.64,
    y: 0.45,
    depth: 500,
    scale: 1 / Math.pow(2, 14),
  };

  let startTime = Date.now();
  let set = constructSet(_.extend({}, params, {
    width: params.width * 4,
    height: params.height * 4,
  }));
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    let set2 = constructSet(_.extend({}, params, {
      scale: params.scale / 2,
      depth: 1000,
    }));

    console.log(`Drawn base images after ${Date.now() - startTime}ms`);
    // image2.invert();
    let combined = CombinedStream.create();

    const framesPerLevel = 15;
    const power = Math.exp(Math.log(2) / framesPerLevel);

    for (var i = 0; i < framesPerLevel; i++) {
      let scaledImage = image.clone();
      let newWidth = Math.floor(params.width * Math.pow(power, i));
      let newHeight = Math.floor(params.height * Math.pow(power, i));
      // Jimp.RESIZE_BEZIER Looks better, but is really slow.
      scaledImage.resize(newWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR);
      scaledImage.crop(
        (newWidth - params.width) / 2,
        (newHeight - params.height) / 2,
        params.width,
        params.height
      );

      let s = new stream.PassThrough();
      s.end(scaledImage.bitmap.data);
      combined.append(s);
      console.log(`Drawn frame ${i} after ${Date.now() - startTime}ms`);
    }

    res.writeHead(200, {'Content-Type': 'image/gif'});
    let encoder = new GIFEncoder(params.width, params.height);

    combined.pipe(encoder.createWriteStream({repeat: 0, delay: 0}))
    .pipe(res)
    .on('finish', function () {
      console.log(`Rendered after ${Date.now() - startTime}ms`);
    });
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