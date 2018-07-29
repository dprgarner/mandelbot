# Mandelbot

A twitter bot that tweets images and GIFs of the Mandelbrot set.

Lives at: https://twitter.com/benoitmandelbot

As it stands, this bot generates a zooming-in GIF of the Mandelbrot set with a few preview slides, and tweets it every few hours. It also occasionally replies to the Colour Schemes from the bot @colorschemez.

There is also some code for generating videos instead of GIFs, but that's currently out-of-action, due to the switch to docker-compose and going twice over the Vimeo storage limit.

## Running locally with Docker

If using docker-machine, unset any docker-machine variables with:

```bash
eval $(docker-machine env -u)
```

Then run locally with:

```bash
docker-compose up
```

### Possible env variables

- `TEST` - Renders smaller images when set.
- `LIVE` - Only uploads and tweets media when set.
- `INSTANT` - Disable waiting between tweets.
- `OUTPUT_DIR` - the storage directory for created images, gifs, video clips, and logs.
- Twitter secrets: `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`
- Gfycat secrets: `GFYCAT_CLIENT_ID`, `GFYCAT_CLIENT_SECRET`, `GFYCAT_USERNAME`, `GFYCAT_PASSWORD`
- Vimeo secrets: `VIMEO_CLIENT_ID`, `VIMEO_CLIENT_SECRET`, `VIMEO_ACCESS_TOKEN`

## Running on a Raspberry Pi with Docker

[Set up a Raspberry Pi env with docker-machine](https://gist.github.com/calebbrewer/c41cab61216d8845b59fcc51f36343a7). Set the env variables with:

```bash
eval $(docker-machine env <MACHINE_NAME>)
```

Next, build and run the container with:

```bash
docker-compose -f docker-compose.yml -f docker-compose.pi.yml up --build -d
```

The Raspberry Pi version runs in live mode by default.
