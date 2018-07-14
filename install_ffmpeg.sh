#!/bin/bash -e

# http://www.jeffreythompson.org/blog/2014/11/13/installing-ffmpeg-for-raspberry-pi/

apt-get install -y --force-yes git checkinstall autoconf automake build-essential libass-dev libfreetype6-dev   libtheora-dev libtool libvorbis-dev pkg-config texinfo zlib1g-dev libv4l-dev wget

cd /usr/src
git clone git://git.videolan.org/x264
cd x264
./configure --host=arm-unknown-linux-gnueabi --enable-static --disable-opencl
make
sudo make -j4 install

cd /usr/src
git clone https://github.com/FFmpeg/FFmpeg.git
cd FFmpeg
sudo ./configure --arch=armel --target-os=linux --enable-gpl --enable-libx264 --enable-nonfree
make
sudo make -j4 install