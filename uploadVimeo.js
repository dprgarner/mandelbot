const {client_id, client_secret, access_token} = require('./auth').vimeoAuth;

const Vimeo = require('vimeo').Vimeo;
const winston = require('winston');

let client = new Vimeo(client_id, client_secret, access_token);

module.exports = (fileName) => new Promise((resolve, reject) => {
  client.streamingUpload(fileName, (err, body, statusCode, headers) => {
    if (err) return reject(err);

    client.request(headers.location, function (err, body) {
      if (err) return reject(err);
      let strippedFilename = fileName.substr(0, fileName.length - 4);
      if (strippedFilename[0] === '.') strippedFilename = strippedFilename.substr(2);
      client.request({
        method: 'PATCH',
        path: body.uri,
        query: {
          name: 'Mandelbrot set: ' + strippedFilename,
          description: 'A zoom of the Mandelbrot set.'
        },
      }, (err) => {
        if (err) return reject(err);
        resolve(body.link)
      });
    });
  }, (uploadSize, fileSize) => {
    winston.debug(Math.round((uploadSize / fileSize) * 100) + "% uploaded");
  });
});