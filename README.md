# clean-gdrive-folders
An Electron app to help remove files under a Google Drive folder tree.

A charitable organization asked me to write for them an app to aid the mass removal files under a Google Drive folder tree while keeping the folders themselves intact. Initially I wrote a python script to do the job, but I found that while the command line interface was adequate, it wasn't very user-friendly when folder tree contained folders with duplicate names. There was a need for an UI app.

As the application is intended to be cross-platform, it's implemented using Electron.

Development environment

1. Download and install NodeJS
2. Install Electron using npm


As Google API requires the credentials, for development purposes, follow the instruction on this link https://developers.google.com/drive/api/v3/quickstart/nodejs to enable the Drive API. Download the Client Configuration into the file named credentials.json, and save under the assets subdirectory. Included in this file is the OAuth 2 client id that is used to request user for the necessary access permissions and to obtain access through OAuth authentication.
