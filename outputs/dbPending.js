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

// This output just saves posts and users as `pending` in the database for later fetching

const TemplateOutput = new OutputInterface(
  'template',
  function (name, logger, options, globalOptions) {
    // will be called once when the output is initialized, should return a new instance of the output (`this`)

    this.name = name;
    this.dbName = options.dbName || name;
    this.logger = logger.child({output: 'template', name: name});
    if(options?.logLevel) this.logger.level = options.logLevel;

    // do initialization here

    this.fetched = new Set();
    this.errors = new Set();


    return this;
  },
  async function (query, db, options) {
    // will be called for each post/user, should return true/false for whether the write was successful (only use false for retryable/unexpected errors, like network errors)

    let dbResponse = await db.all("SELECT * FROM fetched WHERE object = ? and instance = ? and status in ('success', 'pending')", [query, `${this.dbName}`]);

    if(dbResponse.length > 0) {
      // already fetched
      return true;
    }

    // do the actual fetching here

    await db.all("INSERT INTO fetched (object, status, instance, type, runTimestamp) VALUES (?, 'pending', ?, ?, ?) ON CONFLICT(object,instance) DO nothing", 
      [query, `${this.dbName}`, this.outputName, global.runTimestamp]); // if successful

    // await db.all("INSERT INTO fetched (object, status, instance, type, runTimestamp) VALUES (?, 'failed', ?, ?, ?)", 
      // [query, `${this.dbName}`, this.outputName, global.runTimestamp]); // if unsuccessful


  },
  function () {
    // will be called once when the program is exiting, should do cleanup and return true/false for whether the cleanup was successful
    // nothing to clean up here, the main db SHOULD NOT be closed here
    return true;
  },
  function () { // needs to be synchronous
    // will be called when the program is exiting, should retry any failed fetches, return value doesn't matter
    return 0;
  }
  
);

module.exports = TemplateOutput;