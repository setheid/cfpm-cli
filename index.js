#!/usr/bin/env node --harmony
'use strict';

let co = require('co');
let prompt = require('co-prompt');
let program = require('commander');
let request = require('superagent');
let fs = require('fs');
let ProgressBar = require('progress');
let url = 'localhost:3000';

program
  .arguments('<file>')
  .option('-u, --username <username>', 'The user to authenticate as')
  // .option('-p, --password <password>', 'The user\'s password')
  .action(function(file) {
    co(function *() {
      let username = yield prompt('username: ');
      // let password = yield prompt.password('password: ');
      let fileSize = fs.statSync(`${process.cwd()}/${file}`).size;
      let fileStream = fs.createReadStream(`${process.cwd()}/${file}`);
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
        .set('author', username)
        .set('filename', file)
        .attach('file', file)
        .end((err, res) => {
          if (!err && res.ok) {
            console.log(`${file} written to data`);
            process.exit(0);
          }

          var errorMessage;
          if (res && res.status === 401) {
            errorMessage = 'file was not uploaded';
          } else if (err) {
            errorMessage = err;
          } else {
            errorMessage = res.text;
          }
          console.log(errorMessage);
          process.exit(1);
        });
    });
  })
 .parse(process.argv);
