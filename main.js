'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');
const url = require('url');

const _  = require('underscore');
const Jimp = require('jimp');

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

function api(queryDict, res) {
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
  function serveStatic(res, contentType, filePath) {
    console.log(contentType, filePath);
    res.writeHead(200, {'Content-Type': contentType});
    fs.createReadStream(filePath).pipe(res);
  }

  let reqDict = url.parse(req.url, true);

  switch (reqDict.pathname) {
    case '/api/':
      return api(reqDict.query, res);
    case '/elm.js':
      return serveStatic(res, 'text/javascript', './elm.js');
    default:
      return serveStatic(res, 'text/html', './index.html');
  }
}).listen(PORT);

console.log(`Server listening on port ${PORT}`)