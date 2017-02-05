const fs = require('fs');
const request = require('request');
const rp = require('request-promise');

const gfycatAuth = require('./auth').gfycatAuth;

const OUTPUT_DIR = process.env.OUTPUT_DIR || '.';

// http://giant.gfycat.com/TightTediousBanteng.gif
// https://giant.gfycat.com/UnlawfulSeveralFluke.gif

module.exports = function(filePath, title) {
  return rp({
    uri: 'https://api.gfycat.com/v1/oauth/token',
    json: true,
    method: 'POST',
    body: gfycatAuth,
  })
  .then((body) => body.access_token)
  .then((token) => {
    const headers = {Authorization: token};
    console.log('Token:', token);
    return rp({
      uri: 'https://api.gfycat.com/v1/gfycats',
      json: true,
      method: 'POST',
      headers,
      body: {title},
    })
    .then(({gfyname, secret}) => {
      console.log({gfyname, secret});

      return rp({
        uri: 'https://filedrop.gfycat.com',
        json: true,
        method: 'POST',
        formData: {
          key: gfyname,
          file: fs.createReadStream(filePath),
        },
      })
      .then(() => `https://giant.gfycat.com/${gfyname}.gif`)
      .catch((err) => reject(err))
    });
  });
}