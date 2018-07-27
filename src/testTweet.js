const url = 'https://giant.gfycat.com/UnequaledWaterloggedAmericanindianhorse.gif';

const stillImages = [
  `./frames/key-0.gif`,
  `./frames/key-5.gif`,
  `./frames/key-10.gif`,
  `./frames/key-14.gif`,
]
const status = `High-resolution GIF here: ${url}`

const {uploadMedia, updateStatus, tweetWithImages} = require('./twitter');
const convertGifsToPng = require('./convertGifsToPng');

return convertGifsToPng(stillImages)
.then((pngImages) => tweetWithImages(pngImages, status))
.then((tweetUrl) => {
  winston.info(`Tweeted: ${tweetUrl}`);
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
})
