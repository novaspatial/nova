#!/bin/bash
# Convert massive images to WebP
ffmpeg -i src/images/nova.png -c:v libwebp -quality 50 src/images/nova.webp
ffmpeg -i src/images/mix.png -c:v libwebp -quality 50 src/images/mix.webp
