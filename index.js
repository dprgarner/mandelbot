const http = require('http');
const fs = require('fs');
const PNG = require('pngjs').PNG;

function randomInt(range) {
  return Math.round(range * Math.random());
}

http.createServer((req, res) => {
  let s = Date.now();
  // res.writeHead(200, {'Content-Type': 'text/plain'});
  // 'Content-type: image/png'
  // res.end('' + randomInt(16));
  let png = new PNG({width: 1024, height: 768});
  let a = randomInt(255);
  let b = randomInt(255);
  let c = randomInt(255);
  let f = 32;
  for (let y=0; y<png.height; y++) {
    for (let x=0; x<png.width; x++) {
      let idx = (png.width * y + x) << 2;
      png.data[idx] = Math.min(255, Math.max(0, a + randomInt(f)));
      png.data[idx+1] = Math.min(255, Math.max(0, b + randomInt(f)));
      png.data[idx+2] = Math.min(255, Math.max(0, c + randomInt(f)));
      png.data[idx+3] = 255;
    }
  }

  res.writeHead(200, {'Content-Type': 'image/png'});
  png
    .pack()
    .pipe(res)
    .once('finish', function () {
      console.log(`PNG outputted after ${Date.now() - s}ms`);
      console.log(`Colours: ${a}, ${b}, ${c}`);
    });
}).listen(80);