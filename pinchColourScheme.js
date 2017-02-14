const fs = require('fs');
const path = require('path');

const _ = require('underscore');
const Color = require('color');
const JPEGDecoder = require('jpg-stream/decoder');
const request = require('request');
const rimraf = require('rimraf');
const toArray = require('stream-to-array');
const Twit = require('twit');
const winston = require('winston');

const {OUTPUT_DIR} = require('./env');
const {twitterAuth} = require('./auth');
const {constructSet, renderSetToFile} = require('./mandelbrot');
var client = new Twit(twitterAuth);

const latestReplyFile = path.join(OUTPUT_DIR, 'latestReply.txt');
const cutoffTime = fs.existsSync(latestReplyFile) ? parseInt(
  fs.readFileSync(latestReplyFile, 'utf8'), 10
) : -1;

function getPopularColourScheme() {
  // Find the most recent tweet by @colourschemez with the most replies which
  // is after a previous tweet time.
  return new Promise((resolve, reject) => {
    client.get(
      'search/tweets',
      {q: 'to:colorschemez', count: 15, result_type: 'recent'},
      (err, data) => {
        if (err) return reject(err);
        // Object where the key is the status ID, and the value is the number
        // of replies to this status
        const tweetsToReplies = _.chain(data.statuses)
        .groupBy('in_reply_to_status_id_str')
        .mapObject(v => v.length)
        .value();

        client.get('statuses/lookup', {id: _.keys(tweetsToReplies)}, (err, data) => {
          if (err) return reject(err);
          data.sort((t1, t2) => {
            let lengthDifference = tweetsToReplies[t2.id_str] - tweetsToReplies[t1.id_str];
            if (lengthDifference) return lengthDifference;
            return Date.parse(t2.created_at) - Date.parse(t1.created_at);
          });
          const tweets = _.filter(_.map(data, t => ({
            id: t.id_str,
            date: Date.parse(t.created_at),
            url: t.entities.media[0].media_url,
          })), t => {
            return t.date > cutoffTime;
          });
          winston.debug(tweets);
          resolve(tweets[0]);
        });
      }
    );
  })
}

// Promise.resolve({
//   id: '829766226901479424',
//   date: 1486972659000,
//   url: 'http://pbs.twimg.com/media/C4Pr_GFUoAAX0Lf.jpg'
// })

function getColours(url) {
  return new Promise((resolve, reject) => {
    request(url)
    .pipe(fs.createWriteStream('./coloursSlide.jpg'))
    .on('finish', err => {
      if (err) return reject(err);
      resolve('./coloursSlide.jpg');
    })
  })
  .then(() => {
    return toArray(
      fs.createReadStream('./coloursSlide.jpg')
      .pipe(new JPEGDecoder)
    );
  })
  .then(data => {
    rimraf.sync('./coloursSlide.jpg');
    coloursCount = {};
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[0].length; j+=3) {
        let c = Color([data[i][j], data[i][j+1], data[i][j+2]]).hex();
        coloursCount[c] = 1 + (coloursCount[c] || 0);
      }
    }

    let colours = _.chain(coloursCount)
    .pairs()
    .sortBy(v => -v[1])
    .first(3)
    .map(v => v[0])
    .map(Color)
    .value();
    return colours;
  });
}
// 'https://pbs.twimg.com/media/C4pb79LVUAEubPe.jpg'

getColours('http://pbs.twimg.com/media/C4p3ZlOVcAAom4n.jpg')
.then(colours => {
  console.log(colours);

  let params = {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    scale: Math.pow(2, -7),
    depth: 200,
    colours: {
      sparse: colours[0].rgb().array(),
      dense: colours[2].rgb().array(),
      mandelbrot: colours[1].rgb().array(),
      mode: 'sparse',
    },
  };
  console.log(params.colours);
  let set = constructSet(params);
  return renderSetToFile(set, params, './colorschemezmb.gif')
})
.then(f => {
  console.log('ok')
  console.log(f);
})
.catch(err => {
  winston.error(err);
});

// getPopularColourScheme()
// .then(tweet => {
//   if (!tweet) {
//     winston.info('No eligible tweets');
//     return;
//   }
//   fs.writeFileSync(latestReplyFile, tweet.date);
//   console.log(tweet);
// })
// .catch(err => {
//   winston.error(err);
// });
