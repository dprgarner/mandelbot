#!/bin/bash -e

# http://www.jeffreythompson.org/blog/2014/11/13/installing-ffmpeg-for-raspberry-pi/
# For non-pi: https://hub.docker.com/r/jrottenberg/ffmpeg/~/dockerfile/

apt-get install -y --force-yes git checkinstall autoconf automake build-essential libass-dev libfreetype6-dev libtheora-dev libtool libvorbis-dev pkg-config texinfo zlib1g-dev libv4l-dev wget

cd /usr/src
git clone git://git.videolan.org/x264
cd x264
./configure --host=arm-unknown-linux-gnueabi --enable-static --disable-opencl --prefix=/opt/ffmpeg
make
make -j4 install

git clone https://github.com/FFmpeg/FFmpeg.git /usr/src/ffmpeg
cd /usr/src/ffmpeg
./configure --arch=armel --target-os=linux --enable-gpl --enable-libx264 --enable-nonfree --prefix=/opt/ffmpeg
make
make -j4 install
