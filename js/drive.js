/**
 * Copyright 2019, Giao Vu
 * 
 * Interface code for Google Drive API, performing folder
 * and file operations.
 */
const {google} = require('googleapis');
const async = require('async');

const maxFolders = 500;    // a limit to avoid having too many folders

/**
 * @typedef {{name: string, id: string, paths: string[], parents: string[], mimeType: string}} folderEntry;
 */

/**
 * @typedef {{delete: string, name: string, id: string}} deletePlanEntry;
 */

/**
 * Construct path for the given file/folder item
 * 
 * @param {{Object.<string, folderEntry>}} dict - an index of entries with ids as keys 
 * @param {string} rootId - id of root folder
 * @param {folderEntry} item - the folder entry to resolve path for
 */
function resolvePath(dict, rootId, item) {
    if (item.paths == null) {
        var paths = [];
        if (item.parents == null) {
            paths.push(item.name);
        } else {
            item.parents.forEach((p) => {
                if (p == rootId) {
                    paths.push(item.name);
                } else if (!(p in dict)) {
                    console.log("Parent folder id " + p + " is missing!");
                    paths.push(item.name);
                } else {
                    var pfolder = dict[p];
                    resolvePath(dict, rootId, pfolder);
                    pfolder.paths.forEach((pp) => {
                        paths.push(pp + '/' + item.name);
                    });
                }
            });
        }
        item.paths = paths;
    }
}

/**
 * Return a promise that will yield a file delete plan based
 * on a search through the folder hierarchy.
 * 
 * @param {Object} drive - Google api drive object
 * @param {string} folderName - folder name
 * @param {string} folderId - folder id
 * @param {function} tellDetail - function accepting a string message
 */
function createDeletePlan(drive, folderName, folderId, tellDetail) {
    return new Promise((resolve, reject) => {
        let query = "'" + folderId + "' in parents";
        let nextPageToken = null;
        let plan = [];
        let subfolders = [];
        tellDetail('Processing folder ' + folderName);
        // delete 'N' means no delete, just a FYI (for folders)
        plan.push({ delete: 'N', name: folderName, id: folderId });
        async.doUntil(function (callback) {
            drive.files.list({
                q: query,
                pageSize: 50,
                fields: 'nextPageToken, files(id, name, mimeType, parents)',
                pageToken: nextPageToken
            }, function (err, res) {
                if (err) {
                    callback(err)
                } else {
                    // collect the files (to delete) and folders (to navigate to)
                    res.data.files.forEach(item => {
                        if (item.mimeType == 'application/vnd.google-apps.folder') {
                            subfolders.push({ name: folderName + '/' + item.name, id: item.id });
                        } else {
                            plan.push({ delete: 'Y', name: folderName + '/' + item.name, id: item.id });
                        }
                    });
                    nextPageToken = res.data.nextPageToken;
                    callback();
                }
            });
        }, function () {
            // repeat until there is no more pageToken
            return (nextPageToken == null);
        }, function (err) {
            if (err) {
                // Handle error
                console.error(err);
                reject(err);
            } else if (subfolders.length == 0) {
                // no subfolder to process
                resolve(plan);
            } else {
                // navigate to each subfolder to collect its respective plan
                async.eachSeries(subfolders.sort(), function (f, callback) {
                    createDeletePlan(drive, f.name, f.id, tellDetail).then(res => {
                        plan = plan.concat(res);
                        callback();
                    }).catch (err => {
                        callback(err);
                    });
                }, function (err) {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(plan);
                    }
                });
            }
        });
    });
}

module.exports = {
    // get root folder id
    getRootFolderId: function(drive) {
        return new Promise((resolve, reject) => {
            drive.files.get({fileId: 'root'}, (err, res) => {
                if (err) {
                    console.log("Unable to retrieve root folder id: " + err);
                    reject(err);
                }
                //console.log(res);
                resolve(res.data.id);
            });
        });
    },
    // get the maximum number of folders allowed in a folder search
    getMaxFolders: function() {
        return maxFolders;
    },
    // get list of folders
    // return a dictionary with two members: folders, and maxed which is true if there are more folders
    getFolders: function(drive, searchName, searchId) {
        return new Promise((resolve, reject) => {
            let query = "mimeType='application/vnd.google-apps.folder'";
            let maxExceeded = false;
            let nextPageToken = null;
            let entryDict = {};
            // asynchronously looping until retrieving all folders
            async.doUntil(function (callback) {
                drive.files.list({
                    q: query,
                    pageSize: 50,
                    fields: 'nextPageToken, files(id, name, mimeType, parents)',
                    pageToken: nextPageToken
                }, function (err, res) {
                    if (err) {
                        callback(err)
                    } else {
                        res.data.files.forEach(item => {
                            var parents = null;
                            if ('parents' in item) {
                                parents = item.parents;
                            }
                            entryDict[item.id] = { 'id': item.id, 'name': item.name, 'parents': parents,
                                'paths': null, 'mimeType': item.mimeType };
                        });
                        // do not continue if the maxFolders limit has been exceeded
                        if (Object.keys(entryDict).length >= maxFolders) {
                            nextPageToken = null;
                            maxExceeded = true;
                        } else {
                            nextPageToken = res.data.nextPageToken;
                        }
                        callback();
                    }
                });
            }, function () {
                // repeat until there is no more pageToken
                return (nextPageToken == null);
            }, function (err) {
                if (err) {
                    // Handle error
                    console.error(err);
                    reject(err);
                } else {
                    // all pages retrieved; first get the root folder id then build the folder list
                    drive.files.get({fileId: 'root'}, (err, res) => {
                        if (err) {
                            console.log("Unable to retrieve root folder id: " + err);
                            reject(err);
                        }
                        const rootId = res.data.id;
                        let folders = [];
                        var keys = Object.keys(entryDict);
                        keys.forEach((k) => {
                            var item = entryDict[k];
                            resolvePath(entryDict, rootId, item);
                            // filter if searchName and/or searchId are provided
                            // searchId search is exact, while search based on name is not
                            if (searchName == null || item.name.includes(searchName)) {
                                if (searchId == null || searchId == item.id) {
                                    folders.push(item);
                                }
                            }
                        });
                        // sort on member name
                        folders.sort((i1, i2) => {
                            const n1 = i1.name;
                            const n2 = i2.name;
                            let cc = 0;
                            if (n1 > n2) {
                                cc = 1;
                            } else if (n1 < n2) {
                                cc = -1;
                            }
                            return cc;
                        });
                        resolve({ 'maxed': maxExceeded, 'folders': folders });
                    });
                }
            });
        });
    },

    /**
     * Export wrapper for function createDeletePlan
     */
    createDeletePlan: function(drive, folderName, folderId, tellDetail) {
        return createDeletePlan(drive, folderName, folderId, tellDetail);
    },

    /**
     * 
     * @param {Object} drive - initialized Google Drive api object 
     * @param {deletePlanEntry[]} plan - plan created by the createDeletePlan promise
     * @param {boolean} simulated - if true, do not actually execute the delete
     * @param {function} tellDetail - function accepting a message
     */
    clearFiles: function(drive, plan, simulated, tellDetail) {
        return new Promise((resolve, reject) => {
            let log = [];
            // remove the files one by one in series (not in parallel)
            async.eachSeries(plan, function (f, callback) {
                if (simulated) {
                    // simulate the file removal
                    log.push({ action: 'D', name: f.name, id: f.id });
                    callback();
                } else {
                    tellDetail('Removing ' + f.name);
                    // call google api to remove the file
                    drive.files.delete({fileId: f.id}, (err, res) => {
                        if (err) {
                            console.log(err);
                            // no callback with err; instead the information is saved in log
                            log.push({ action: 'Error: ' + err, name: f.name, id: f.id });
                        } else {
                            log.push({ action: 'D', name: f.name, id: f.id });
                        }
                        callback();
                    });
                }
            }, function (err) {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(log);
                }
            });
        });
    }
}