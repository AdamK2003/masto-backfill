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

const fs = require('fs');


const JSONOutput = new OutputInterface(
  'json',
  function (name, logger, options, globalOptions) {
    // will be called once when the output is initialized, should return a new instance of the output (`this`)

    this.name = name;
    this.dbName = options.dbName || name;
    this.logger = logger.child({output: this.outputName, name: name});
    if(options?.logLevel) this.logger.level = options.logLevel;

    // do initialization here

    this.file = options.file;

    this.fetched = new Set(); // we don't really need the db for this? maybe later
    this.posts = new Set();
    this.users = new Set();
    // this.errors = new Set();


    return this;
  },
  async function (query, db, options) {
    // will be called for each post/user, should return true/false for whether the write was successful

    if(this.fetched.has(query)) {
      // maybe do logging
      return true;
    }


    // do the actual fetching here

    if(query.startsWith('@')) {
      this.users.add(query);
    } else {
      this.posts.add(query);
    }


    this.fetched.add(query); // if successful
    // this.errors.add(query); // if unsuccessful


  },
  async function () {
    // will be called once when the program is exiting, should return true/false for whether the close was successful

    const data = {
      posts: [...this.posts],
      users: [...this.users]
    }

    try {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf8')
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }

  },
  async function () {
    // individual writes can't fail here, so this is not needed
    return true;
  }
  
);

module.exports = JSONOutput;