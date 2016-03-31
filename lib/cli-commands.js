'use strict';

let co = require('co');
let prompt = require('co-prompt');
let program = require('commander');
let request = require('superagent');
let fs = require('fs');
let archiver = require('archiver');
let unzip = require('unzip2');
let TOKEN = require('./../auth').TOKEN;

let url = 'localhost:3000';
let aboutBody, currentName, currentVersion, proj;

module.exports = exports = {};

program
  .option('-v --proj-version [number]', 'declare a version')
  .option('-p --project [project]', 'declare a project to fetch')
  .parse(process.argv);

function readToken() {
  if (!TOKEN) {
    console.log('Credentials have not been verified. Run "cfpm token" to get your authorization token.');
    return process.exit(0);
  }
  return;
}

function readProj() {
  var read = new Promise(function(resolve, reject) {
    fs.readFile(`${process.cwd()}/.about.json`, (err, data) => {
      if (err) {
        console.log('Run "cfpm init" initialize your project before publishing.');
        return process.exit(1);
      }
      aboutBody = JSON.parse(data.toString());
      currentName = aboutBody.name;
      currentVersion = aboutBody.version;
      return resolve(true);
    });
  })
  return read;
}

exports.getToken = function() {
  co(function *() {
    var username = yield prompt('username: ');
    if (username.match(/(\s)/g)) {
      console.log('Username cannot have spaces');
      return process.exit(1);
    }
    var password = yield prompt('password: ');
    if (password.match(/(\s)/g)) {
      console.log('Password cannot have spaces');
      return process.exit(1);
    }
    request
      .post(url + '/login')
      .auth(username, password)
      .end((err, res) => {
        if (err) return console.log(err);
        if (res.body.token) {
          fs.writeFile(`${__dirname}/../auth.js`, `module.exports = ${JSON.stringify({'TOKEN': res.body.token})}`, () => {
            console.log('Username and Password accepted. An authorization token has been saved.');
            return process.exit(0);
          });
        }

        if (res.body && !res.body.token) {
          console.log('Username or Password did not match');
          return process.exit(1);
        }
      });
  });
}

exports.initProj = function() {
  // TODO: no spaces!
  var projName, versionNum, description, data;
  co(function *() {
    projName = yield prompt('Project Name: ');
    if (projName.match(/(\s)/g)) {
      console.log('Project name cannot have spaces');
      return process.exit(1);
    }
    versionNum = yield prompt('Version: (0.1.0) ');
    description = yield prompt('Description: ');
    if (!versionNum) versionNum = '0.1.0';
    console.log(`Project: ${projName} v:${versionNum}`);
  })
  .then(() => {
    aboutBody = {
      "name": projName,
      "version": versionNum,
      "description": description
    }
    fs.writeFile(process.cwd() + '/.about.json', JSON.stringify(aboutBody, null, "\t"), () => {
      process.exit(0);
    });
  })
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
}

exports.publishProj = function() {
  readToken();
  readProj()
  .then(() => {
    let output = fs.createWriteStream(`${__dirname}/../temp/target.zip`);
    let archive = archiver.create('zip');
    archive.pipe(output);
    archive.directory(`${process.cwd()}`, '');
    archive.finalize();

    output.on('close', () => {
      request
        .post(url + '/projects')
        .set('authorization', `token ${TOKEN}`)
        .set('projectname', currentName)
        .set('version', currentVersion)
        .attach('file', `${__dirname}/../temp/target.zip`)
        .end((err, res) => {
          if (err) {
            console.log(res.body.msg);
            return console.log('upload unsuccessful');
          }
          fs.unlink(`${__dirname}/../temp/target.zip`, () => {
            console.log('upload complete');
          });
        });
    });
  })
  .catch(err => console.log(err));
}

exports.updateProj = function() {
  readToken();
  readProj()
  .then(() => {
    if(!program.projVersion) return console.log('You must declare a version. Ex: "cfpm update -v 0.2.0"');
    aboutBody.version = program.projVersion;
    fs.writeFileSync(process.cwd() + '/.about.json', JSON.stringify(aboutBody, null, '\t'));

    let output = fs.createWriteStream(`${__dirname}/../temp/target.zip`);
    let archive = archiver.create('zip');
    archive.pipe(output);
    archive.directory(`${process.cwd()}`, '');
    archive.finalize();

    output.on('close', () => {
      request
        .put(url + '/projects')
        .set('authorization', `token ${TOKEN}`)
        .set('projectname', currentName)
        .set('version', program.projVersion)
        .attach('file', `${__dirname}/../temp/target.zip`)
        // .attach('file', fileStream)
        .end((err, res) => {
          fs.unlink(`${__dirname}/../temp/target.zip`, () => {
            if (err) {
              console.log(res.body.msg);
              return console.log('upload unsuccessful');
            }
            console.log('upload successful');
          });
        });
    });
  });
}

function binaryParser(res, callback) {
  res.setEncoding('binary');
  res.data = '';
  res.on('data', function (chunk) {
    res.data += chunk
  });
  res.on('end', function () {
    callback(null, new Buffer(res.data, 'binary'));
  });
}

function unpackage(directory) {
  fs.createReadStream('archive.zip')
  .pipe(
    unzip
      .Extract({ path: directory })
        .on('close', () => {
          fs.unlink('archive.zip', () => {
            return;
          });
        })
    );
}

exports.fetchProj = function() {
  if(!program.project) return console.log('You must include a project name. Ex: "cfpm fetch -p my-project"');
  readToken();
  request
    .get(url + '/projects')
    .set('projectname', program.project)
    .set('version', program.projVersion || 'current')
    .buffer(true)
    .parse(binaryParser)
    .end(function(err, res) {
      if (err) {
        console.log(res.body.msg);
        return console.log('download unsuccessful');
      }
      fs.writeFile('archive.zip', res.body, (err) => {
        if (err) throw err;
        console.log('writing complete');
        unpackage(process.cwd());
      });
    });
}
