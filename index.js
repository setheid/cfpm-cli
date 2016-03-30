#!/usr/bin/env node --harmony
'use strict';
// TODO: get -v flag for publish, update, and download requests using commander
// TODO: write consistent error message / catch

let co = require('co');
let prompt = require('co-prompt');
// let program = require('commander');
let request = require('superagent');
let fs = require('fs');
let ProgressBar = require('progress');
let archiver = require('archiver');
let url = 'localhost:3000';
let TOKEN, aboutBody, currentName, currentVersion;

var readProj = new Promise((resolve, reject) => {
  fs.readFile(`${process.cwd()}/.about.json`, (err, data) => {
    aboutBody = JSON.parse(data.toString());
    currentName = aboutBody.name;
    currentVersion = aboutBody.version;
    return resolve(true);
  });
});

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
    request
      .post(url + '/login')
      .auth(username, password)
      .end((err, res) => {
        if (res.body.token) {
          fs.writeFile(`${__dirname}/auth.json`, JSON.parse(`{TOKEN: ${res.body.token}}`), () => {
            console.log('Username and Password accepted. An authorization token has been saved.');
            return process.exit(0);
          });
        }

        if (res.body) {
          console.log('Username or Password did not match');
          return process.exit(1);
        }

        console.log(err);
        return process.exit(1);
      });
  });
}

function initProj() {
  var projName, versionNum, description, data;
  co(function *() {
    yield readToken;
    projName = yield prompt('Project Name: ');
    versionNum = yield prompt('Version Number: (0.1.0) ');
    description = yield prompt('Description: ');
    if (!versionNum) versionNum = '0.1.0';
    console.log(`${projName} v:${versionNum}`);
  })
  .then(() => {
    console.log();
    about = {
      "name": projName,
      "version": versionNum,
      "description": description
    }
    fs.writeFile(process.cwd() + '/.about.json', JSON.stringify(about, null, "\t"), () => {
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
    yield readProj;
  })
  .then(() => {
    request
      .get(url + `/projects`)
      .end((err, res) => {
        if (err) {
          console.log('file was not installed');
          return process.exit(1);
        }
        console.log(`project installed`);
        process.exit(0);
      });
  });
}

function publishProj() {
  // TODO: What happens to project inbetween the time it is initialized and published?
  // How is version updated before publishing? Maybe same as update.
  co(function *() {
    yield readToken;
    yield readProj;
  })
  .then(() => {
    // TODO: read about progress bar
    let fileSize = fs.statSync(`${process.cwd()}/project`).size;
    // let fileStream = fs.createReadStream(`${process.cwd()}/project`);
    let barOpts = {
      width: 20,
      total: fileSize,
      clear: true
    };
    let bar = new ProgressBar(' uploading [:bar] :percent :etas', barOpts);
    let output = fs.createWriteStream('target.zip');
    let archive = archiver.create('zip');
    fileStream.on('data', function(chunk) {
      bar.tick(chunk.length);
    });
    archive.pipe(output);
    archive.directory(`${process.cwd()}/project`, '');
    archive.finalize();

    output.on('close', () => {
      request
        .put(url + '/projects')
        .set('authorization', `token ${TOKEN}`)
        .set('projectname', currentName)
        .set('version', '0.5.8')
        .attach('file', 'target.zip')
        // .attach('file', fileStream)
        .end((err, res) => {
          console.log(res.body);
          if (err) return console.log('upload unsuccessful:');
          fs.unlink('target.zip', () => {
            console.log('upload complete');
          });
        });
    });
  });
}

function updateProj() {
  co(function *() {
    yield readToken;
    yield readProj;
  })
  .then(() => {
    if(!process.argv[process.argv.indexOf('update') + 2]) return console.log('You must declare a version. ex: "cfpm update -v 0.1.0"');

    aboutBody.version = process.argv[process.argv.indexOf('update') + 2];
    fs.writeFile(process.cwd() + '/.about.json', JSON.stringify(aboutBody, null, '\t'), () => {
      console.log('.about.json updated');
      request
      .put(url + '/projects')
      .set('authorization', `token ${TOKEN}`)
      .end((err, res) => {
        if (err) return console.log(err); {
          console.log(`project updated`);
        }
        console.log(errorMessage);
      });
    });
  });
}

var commands = {
  token: getToken,
  init: initProj,
  install: installProj, // maybe rename download?
  publish: publishProj,
  update: updateProj
};

function executeCommands(args) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] === 'token' || 'init' || 'install' || 'publish' || 'update') {
      return commands[args[i]]();
    }
  }
}

executeCommands(process.argv.slice(2));
