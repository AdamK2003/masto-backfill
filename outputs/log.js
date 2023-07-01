/*
    masto-backfill - A tool to backfill Mastodon instances with posts from other instances
    Copyright (C) 2023 Adam K

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/


const OutputInterface = require('./outputClass.js');

// This is a dummy logger output that just logs to the console

const DummyLoggerOutput = new OutputInterface(
  'log',
  function (name, logger, options, globalOptions) {
    // will be called once when the output is initialized, should return a new instance of the output (`this`)

    this.name = name;
    this.logger = logger.child({output: 'log', name: name});
    if(options?.logLevel) this.logger.level = options.logLevel;

    this.logger.info(`Init called on dummy logger output ${this.name}`)
    if(options) this.logger.info(`Options: ${JSON.stringify(options)}`)
    if(globalOptions) this.logger.info(`Global options: ${JSON.stringify(globalOptions)}`)

    this.fetched = new Set();

    
    return this;
  },
  async function (query, options) {
    // will be called for each post/user, should return true/false for whether the write was successful

    
    if (this.fetched.has(query)) {
      this.logger.debug(`Dummy logger output ${this.name} already fetched query ${query}`);
    } else {
      this.logger.info(`Dummy logger output ${this.name} called with query ${query}`);
      this.fetched.add(query);
    }

  },
  function () {
    // will be called once when the program is exiting, should return true/false for whether the close was successful
    this.logger.info(`Close called on dummy logger output ${this.name}`)
    return true;
  },
  async function () {
    this.logger.info(`Retry called on dummy logger output ${this.name}`)
    return true;
  }
  
);

module.exports = DummyLoggerOutput;