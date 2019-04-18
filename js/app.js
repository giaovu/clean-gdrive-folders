/**
 * App module, controlling all UI functions.
 */
const {google} = require('googleapis');
const gauth = require('./js/gauth.js');
const gdrive = require('./js/drive.js');

const outputdiv = document.getElementById('outputdiv');
const statusdiv = document.getElementById('statusdiv');

const scopes = [
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive'
];

let myGAuth = null;
let myGDrive = null;
let deletePlan = null;

function hideElement(elem, hide) {
    elem.style.display = hide ? 'none' : 'block';
}

/**
 * Change UI busy state.
 * 
 * @param {boolean} busy - if true, change display to show the app as busy
 * @param {string} msg - message to display, informing of current operation
 */
function setBusyState(busy, msg) {
    hideElement(busydiv, !busy);
    hideElement(searchbtn, busy);
    hideElement(outputdiv, busy);
    document.getElementById("busymsgdiv").innerHTML = msg == null ? '' : '<p>...' + msg + '...</p>';
    if (busy) {
        statusdiv.innerHTML = '';
    }
}

function getGAuthPromise() {
    if (myGAuth == null) {
        myGAuth = new Promise((resolve, reject) => {
            gauth.authenticate(scopes).then(auth => {
                resolve(auth);
            }).catch (err => {
                reject(err);
            });
        });
    }
    return myGAuth;
}

function getGDrivePromise() {
    if (myGDrive == null) {
        setBusyState(true, 'Requesting Google authorization (check browser)');
        myGDrive = new Promise((resolve, reject) => {
            getGAuthPromise().then(auth => {
                resolve(google.drive({version: 'v3', auth}));
            }).catch(err => {
                reject(err);
            });
        });    
    }
    return myGDrive;
}

function updateStatus(msg) {
    statusdiv.innerHTML = '<p>' + msg + '</p>';
}

function clearSelectedFolder() {
    document.getElementById("specifiedName").innerHTML = "<i>Not Selected</i>";
    document.getElementById("specifiedId").style.display = 'none';
    outputdiv.innerHTML = '';
}

function renderPlan(plan, err) {
    var html;
    if (plan == null || plan.length == 0) {
        html = '<div class="notice">Invalid folder</div>';
        updateStatus('Unable to create a delete plan: ' + err);
        deletePlan = null;
    } else {
        deletePlan = [];
        html = '<table class="plans"><tr><th>Delete?</th><th>Name</th><th>Id</th></tr>' +
            plan.map((f) => {
                var optclass;
                if (f.delete == 'Y') {
                    optclass = ' class="cdelete"';
                    deletePlan.push(f);
                } else {
                    optclass = '';
                }
                return '<tr' + optclass + '><td>'
                    + f.delete + '</td><td>'
                    + f.name + '</td><td>'
                    + f.id + "</td></tr>";
            }).join('') +
            '</table>';
        if (deletePlan == null || deletePlan.length == 0) {
            updateStatus("There are no file(s) to remove");
            deletePlan = null;
        } else {
            updateStatus('Number of files to be removed: <span class="cdelete">' + deletePlan.length + '</span>.  (' +
                (plan.length - deletePlan.length) + ' folders examined)');
            hideElement(clearbtn, false);
        }
    }
    outputdiv.innerHTML = html;
    setBusyState(false, null);
}

function tellDetail(msg) {
    document.getElementById('busydetaildiv').innerHTML = '<p>' + msg + '...</p>';
}

function selectFolder(foldername, folderid) {
    //updateStatus('Folder id ' + folderid + ' selected');
    const nameElem = document.getElementById('specifiedName');
    nameElem.innerHTML = "<b>Name</b>: " + foldername;
    const idElem = document.getElementById('specifiedId');
    idElem.style.display = 'block';
    idElem.innerHTML = "<b>Id</b>: " + folderid;
    // formulate a delete plan
    getGDrivePromise().then(drive => {
        setBusyState(true, 'Examining folder contents');
        gdrive.createDeletePlan(drive, foldername, folderid, tellDetail).then(plan => {
            renderPlan(plan);
        }).catch(err => {
            renderPlan(null, err);
        });
    }).catch(err => {
        renderPlan(null, err);
    });
}

function renderFolders(folders) {
    var html;
    if (folders.length == 0) {
        html = '<div class="notice">Search found no folders</div>';
    } else {
        html = '<table class="folders"><tr><th>Name</th><th>Id</th><th>Folder Paths</th></tr>' +
            folders.map((f) => {
                return '<tr onclick="selectFolder(\'' + f.name + '\', \'' + f.id + '\');return false;"><td>'
                    + f.name + '</td><td>' + f.id
                    + '</td><td>' + f.paths.join('<br/>')
                    + "</td></tr>";
            }).join('') +
            '</table>';
    }
    outputdiv.innerHTML = html;
    setBusyState(false, null);
}

function renderLog(log, err) {
    if (log == null || log.length == 0) {
        outputdiv.innerHTML = '<div class="notice">No operation taken</div>';
        updateStatus('Clean up operation did not take complete as expected: ' + err);
    } else {
        var errorCount = 0;
        outputdiv.innerHTML = '<table class="logs"><tr><th>Name</th><th>Id</th><th>Action taken</th></tr>' +
            log.map((l) => {
                var aclass;
                var action;
                if (l.action == 'D') {
                    aclass = 'aremoved';
                    action = 'Removed';
                } else {
                    aclass = 'aerror';
                    action = l.action;
                    errorCount++;
                }
                return '<tr class="' + aclass + '"><td>' + l.name
                    + '</td><td>' + l.id
                    + '</td><td>' + action
                    + "</td></tr>";
            }).join('') +
            '</table>';
        if (errorCount == 0) {
            updateStatus('Clean up operation is successful');
        } else {
            updateStatus(errorCount + ' issues found. Please review the issues');
        }
    }
    setBusyState(false, null);
}

/**
 * Event handler for Search button clicks.
 */
searchbtn.addEventListener('click', () => {
    // clear out the old plan (if any exists)
    deletePlan = null;
    hideElement(clearbtn, true);
    // retrieve folder list
    getGDrivePromise().then(drive => {
        var searchName = document.getElementById("foldername").value;
        var searchId = document.getElementById("folderid").value;
        if (searchName.length == 0)
            searchName = null;
        if (searchId.length == 0)
            searchId = null;
        setBusyState(true, 'Searching for folders');
        gdrive.getFolders(drive, searchName, searchId).then(res => {
            renderFolders(res.folders, null);
            if (res.maxed) {
                outputStatus('The number of folders exceeds the allowed maximum of ' + gdrive.getMaxFolders() +
                    '. You may need to refine the search criteria');
            }
        }).catch(err => {
            renderFolders(null, err);
        });
    }).catch(err => {
        renderFolders(null, err);
    })
});

clearbtn.addEventListener('click', () => {
    if (deletePlan == null || deletePlan.length == 0) {
        alert("There are no files to remove!");
        return;
    }
    var r = confirm("Are you sure? The files will be removed permanently!");
    if (r != true) {
        return;
    }
    
    getGDrivePromise().then(drive => {
        setBusyState(true, 'Clearing folder contents per plan');
        gdrive.clearFiles(drive, deletePlan, false, tellDetail).then(log => {
            renderLog(log, null);
            //updateStatus('Clear operation completed as log shows');
        }).catch(err => {
            renderLog(null, err);
        });
    }).catch(err => {
        renderLog(null, err);
    });
});


clearSelectedFolder();
setBusyState(false, null);
hideElement(clearbtn, true);
