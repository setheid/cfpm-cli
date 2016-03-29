#!/usr/bin/env node --harmony
'use strict';

let co = require('co');
let prompt = require('co-prompt');
let program = require('commander');
let request = require('superagent');
let fs = require('fs');
let ProgressBar = require('progress');
let url = 'localhost:3000';
let TOKEN;

var readToken = new Promise((resolve, reject) => {
  fs.readFile(`${__dirname}/auth.json`, (err, data) => {
    if (err) {
      console.log('Credentials have not been verified. Run "cfpm token" to get your authorization token.');
      process.exit(0);
    }
    var auth = JSON.parse(data.toString());
    TOKEN = auth.TOKEN;
    return resolve(true);
  });
});

function getToken() {
  co(function *() {
    var username = yield prompt('username: ');
    var password = yield prompt.password('password: ');
    console.log(username, password);
    request
      .post(url + '/login')
      .auth(username, password)
      .end((err, res) => {
        if (!err && res.ok) {
          console.log(`testDocument.html published`);
          fs.writeFile(`${__dirname}/auth.json`, JSON.parse(`{TOKEN: ${res.headers.token}}`), () => {
            console.log('Username and Password accepted. An authorization token has been saved.');
            process.exit(0);
          })
        }

        var errorMessage;
        if (res && res.status === 401) {
          errorMessage = 'Username or Password was not found';
        } else if (err) {
          errorMessage = err;
        } else {
          errorMessage = res.text;
        }
        console.log(errorMessage);
        process.exit(1);
      });
  });
}

function initProj() {
  var projName, versionNum, description, data;
  co(function *() {
    yield readToken;
    projName = yield prompt('Project Name: ');
    versionNum = yield prompt('Version Number: (0.0.1) ');
    description = yield prompt('Description: ');
    if (!versionNum) versionNum = '0.0.1';
    console.log(`${projName} v:${versionNum}`);
  })
  .then(() => {
    console.log();
    data = {
      "name": projName,
      "version": versionNum,
      "description": description
    }
    fs.writeFile(process.cwd() + '/.about.json', JSON.stringify(data, null, "\t"), () => {
      console.log('.about.json written');
      process.exit(0);
    });
  })
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
}

function installProj() {
  co(function *() {
    yield readToken;
  })
  .then(() => {
    request
      .get(url + `/projects`)
      .end((err, res) => {
        if (!err && res.ok) {
          console.log(`project installed`);
          process.exit(0);
        }

        var errorMessage;
        if (res && res.status === 401) {
          errorMessage = 'file was not installed';
        } else if (err) {
          errorMessage = err;
        } else {
          errorMessage = res.text;
        }
        console.log(errorMessage);
        process.exit(1);
      });
  });
}

function publishProj() {
  co(function *() {
    yield readToken;
  })
  .then(() => {
    let fileSize = fs.statSync(`${process.cwd()}/testDocument.html`).size;
    let fileStream = fs.createReadStream(`${process.cwd()}/testDocument.html`);
    let barOpts = {
      width: 20,
      total: fileSize,
      clear: true
    };
    let bar = new ProgressBar(' uploading [:bar] :percent :etas', barOpts);
    fileStream.on('data', function(chunk) {
      bar.tick(chunk.length);
    });

    request
      .post(url + '/projects')
      .set('projectname', 'testproject-name')
      .set('filename', 'testDocument.html')
      .set('Authorization', `token ${TOKEN}`)
      .attach('file', 'testDocument.html')
      .attach('file', fileStream)
      .end((err, res) => {
        if (!err && res.ok) {
          console.log(`testDocument.html published`);
        }

        var errorMessage;
        if (res && res.status === 401) {
          errorMessage = 'file was not published';
        } else if (err) {
          errorMessage = err;
        } else {
          errorMessage = res.text;
        }
        console.log(errorMessage);
      });
  });
}

function updateProj() {
  co(function *() {
    yield readToken;
  })
  .then(() => {
    if(!process.argv[process.argv.indexOf('update') + 2]) return console.log('You must declare a version. ex: "cfpm update -v 0.1.0"');

    fs.readFile(`${process.cwd()}/.about.json`, (err, data) => {
      var about = JSON.parse(data.toString());
      about.version = process.argv[process.argv.indexOf('update') + 2];
      fs.writeFile(process.cwd() + '/.about.json', JSON.stringify(about, null, "\t"), () => {
        console.log('.about.json updated');
        request
        .put(url + '/projects')
        .set('Authorization', `token ${TOKEN}`)
        .end((err, res) => {
          if (!err && res.ok) {
            console.log(`project updated`);
          }

          var errorMessage;
          if (res && res.status === 401) {
            errorMessage = 'Username or Password was not found';
          } else if (err) {
            errorMessage = err;
          } else {
            errorMessage = res.text;
          }
          console.log(errorMessage);
        });
      });
    });
  });
}

var commands = {
  token: getToken,
  init: initProj,
  install: installProj,
  publish: publishProj,
  update: updateProj
};

function executeCommands(args) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] === 'token' || 'init' || 'install' || 'publish' || 'update') return commands[args[i]]();
  }
}

executeCommands(process.argv.slice(2));
