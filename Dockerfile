ARG base_image

FROM ${base_image}

RUN mkdir /app
WORKDIR /app

# Compiling takes a very very long time on a Raspberry Pi. Let's hope the image works.
# TODO make it a service...
COPY --from=ffmpeg /usr/local /usr/local

# Set up Gifsicle
RUN apt-get update && apt-get -y install \
    gifsicle \
&& rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock /app/
RUN yarn
COPY . /app/

CMD ["yarn", "start", "-s"]
