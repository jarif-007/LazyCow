#!/bin/bash

# Open Chrome
nohup google-chrome --profile-directory="Profile 1" \
"https://classroom.google.com/c/ODQ5NDIyOTk3NzQ4" \
"https://chatgpt.com/" \
"https://www.youtube.com/" \
>/dev/null 2>&1 &

# Open VS Code
nohup code >/dev/null 2>&1 &

exit 0
