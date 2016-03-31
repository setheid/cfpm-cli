#!/usr/bin/env node
'use strict';

let cli = require('./lib/cli-commands');

var commands = {
  token: cli.getToken,
  init: cli.initProj,
  fetch: cli.fetchProj,
  publish: cli.publishProj,
  update: cli.updateProj
};

function executeCommands(args) {
  var i, j;
  var command = ['token', 'init', 'fetch', 'publish', 'update'];
  for (i = 0; i < args.length; i++) {
    for (j = 0; j < command.length; j++) {
      if (args[i] === command[j]) {
        return commands[command[j]]();
      }
    }
  }
}

executeCommands(process.argv.slice(2));
