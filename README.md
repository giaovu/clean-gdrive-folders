# clean-gdrive-folders
An Electron app to help remove files under a Google Drive folder tree while leaving the folder hierarchy intact.

As the application is intended to be cross-platform, its implementation is based on Electron.

Development environment

1. Download and install NodeJS
2. Install Electron using npm
3. As Google API requires the credentials, follow the instruction on the link https://developers.google.com/drive/api/v3/quickstart/nodejs to enable the Drive API. Download the Client Configuration into the file named credentials.json, and save under the assets subdirectory (it needs to be created as the repository does not include it.) Included in this file is the OAuth 2 client id that is used to request user for the necessary access permissions and to obtain access through OAuth authentication.

To run the application in development environment:
```
npm start
```
