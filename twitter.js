const fs = require('fs');
const Twitter = require('twitter');

const {twitterAuth} = require('./auth');

// Uploadable GIF, and tweet text.
const pathToGif = './big.gif';
const tweetText = 'a somewhat larger mandelbrot set.'

// Most of the following was copy/pasted from the Twitter client Readme
// because I'm being lazy.
let client = new Twitter(twitterAuth);

/**
 * (Utility function) Send a POST request to the Twitter API
 * @param String endpoint  e.g. 'statuses/upload'
 * @param Object params    Params object to send
 * @return Promise         Rejects if response is error
 */
function makePost(endpoint, params) {
  return new Promise((resolve, reject) => {
    client.post(endpoint, params, (error, data, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Step 1 of 3: Initialize a media upload
 * @return Promise resolving to String mediaId
 */
function initUpload() {
  return makePost('media/upload', {
    command    : 'INIT',
    total_bytes: fs.statSync(pathToGif).size,
    media_type : 'image/gif',
  }).then(data => data.media_id_string);
}

/**
 * Step 2 of 3: Append file chunk
 * @param String mediaId    Reference to media object being uploaded
 * @return Promise resolving to String mediaId (for chaining)
 */
function appendUpload(mediaId) {
  return makePost('media/upload', {
    command      : 'APPEND',
    media_id     : mediaId,
    media        : fs.readFileSync(pathToGif),
    segment_index: 0
  }).then(data => mediaId);
}

/**
 * Step 3 of 3: Finalize upload
 * @param String mediaId   Reference to media
 * @return Promise resolving to mediaId (for chaining)
 */
function finalizeUpload(mediaId) {
  return makePost('media/upload', {
    command : 'FINALIZE',
    media_id: mediaId
  }).then(data => mediaId);
}

initUpload() // Declare that you wish to upload some media
.then(appendUpload) // Send the data for the media
.then(finalizeUpload) // Declare that you are done uploading chunks
.then(mediaId => {
  // You now have an uploaded movie/animated gif
  // that you can reference in Tweets, e.g. `update/statuses`
  // will take a `mediaIds` param.

  // Let's tweet it
  var status = {
    status: tweetText,
    media_ids: mediaId // Pass the media id string
  }

  client.post('statuses/update', status, function(error, tweet, response) {
    if (!error) {
      console.error(tweet);
      process.exit(1);
    } else {
      console.log('Tweet successful');
    }
  });
})
.catch((err) => {
  console.error(err);
  process.exit(1);
});
