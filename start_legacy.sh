#!/bin/bash -e

# Deprecated.
# TODO figure out some better logging and notifying with Docker.

send_email() {
  echo "Mandelbot exited with an error" | mail -s "Mandelbot error" dprgarner@gmail.com
  sleep 3600
}

while true; do
    node index.js || send_email
    sleep 5
done
