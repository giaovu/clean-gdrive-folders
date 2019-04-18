/**
 * gauth module.
 * 
 * @author  Giao Vu <giao.t.vu@gmail.com>
 */
const fs = require('fs');
const {google} = require('googleapis');
const http = require('http');
const url = require('url');
const destroyer = require('server-destroy')

const credjson = './assets/credentials.json';

const port = 6789;

const baseurl = 'http://localhost:' + port;

const callbackname = '/oauth2cb';

const callbackurl = baseurl + callbackname;

var creds = new Promise((resolve, reject) => {
    fs.readFile(credjson, (err, data) => {
        if (err) {
            console.log(credjson + ' read error: ' + err);
            reject(err);
        } else {
            resolve(JSON.parse(data).installed);
        }
    })
});

module.exports = {
    /**
     * Get the credentials promise.
     */
    getCredentials: function() {
        return creds;
    },

    /**
     * Obtain Google api permissions/authenticate with the given scopes.
     * This uses a localhost server callback.
     * 
     * @param {string[]} scopes - scopes to gain permission for
     */
    authenticate: function(scopes) {
        return new Promise((resolve, reject) => {
            creds.then(keys => {
                const oauth2Client = new google.auth.OAuth2(
                    keys.client_id,
                    keys.client_secret,
                    callbackurl
                );
                // grab the url that will be used for authorization
                const authorizeUrl = oauth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: scopes.join(' '),
                });
                let authWindow = null;
                // start a server to wait for the callback
                const server = http.createServer(async (req, res) => {
                    try {
                        if (req.url.indexOf(callbackname) > -1) {
                            const qs = new url.URL(req.url, baseurl).searchParams;
                            res.end('Authentication successful! You may close this browser tab/window');
                            // close the auth browser window
                            if (authWindow != null) {
                                authWindow.close();
                            }
                            // shutdown the server
                            server.destroy();
                            const {tokens} = await oauth2Client.getToken(qs.get('code'));
                            // the tokens could be saved to allow the use of this app without
                            // having to go through the entire OAuth exercise everytime.
                            // But the current behavior is more secure and therefore acceptable.
                            oauth2Client.credentials = tokens;
                            resolve(oauth2Client);
                        }
                    } catch (e) {
                        reject(e);
                    }
                }).listen(port, () => {
                    //open the browser to the authorize url to start the workflow
                    authWindow = window.open(authorizeUrl, "Google Drive Access Authentication",
                                    'width=800,height=720');
                });
                destroyer(server);
            }).catch (err => {
                reject(err);
            });
        });
    }
}