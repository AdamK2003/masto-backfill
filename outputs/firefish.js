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

const axios = require('axios');
const axiosRetry = require('axios-retry');
const rateLimit = require('axios-rate-limit');

// This output fetches posts on a Firefish (possibly other Misskey compatible too, not tested) instance directly via the API

const FirefishOutput = new OutputInterface(
  'firefish',
  function (name, logger, options, globalOptions) {

    this.name = name;
    this.dbName = options.dbName || name;
    this.logger = logger.child({ output: 'firefish', name: name });
    if(options?.logLevel) this.logger.level = options.logLevel;

    if(!options.token) {
      throw new Error('No token provided for Firefish instance ' + name);
    }

    let client = rateLimit(
      axios.create({
        baseURL: `https://${name}`,
        timeout: options?.timeout || 15000,
        headers: {
          'User-Agent': options?.userAgent || 'masto-backfill/1.0.0' + (globalOptions?.contact ? `; +${globalOptions.contact}` : ''),
          'Authorization': options.token,
        }
      }),
      { 
        maxRPS: options?.maxRPS || 3
      }
    );
  
    axiosRetry(client, {
      retries: 5,
      shouldResetTimeout: true,
      retryDelay: axiosRetry.exponentialDelay
    })

    this.client = client;

    this.postsEnabled = options?.posts == undefined ? true : options?.posts;
    this.usersEnabled = options?.users == undefined ? true : options?.users;

    this.fetched = new Set();
    this.errors = new Set();
    this.fetchedCount = 0;
    this.errorsCount = 0;

    return this;
  },
  async function (query, db, options) {

    if(!query) {
      this.logger.debug(`No query provided for ${this.name}`);
      return true;
    }

    if(query.startsWith('@')) {
      if(!this.usersEnabled) {
        this.logger.debug(`Users disabled on ${this.name}, not fetching ${query}`);
        return true;
      }
    } else {
      if(!this.postsEnabled) {
        this.logger.debug(`Posts disabled on ${this.name}, not fetching ${query}`);
        return true;
      }
    }

    let dbResponse = await db.all("SELECT * FROM fetched WHERE object = ? and instance = ? and status = 'success'", [query, `${this.dbName}`]);

    if(dbResponse.length > 0) {
      this.logger.debug(`Already fetched ${query} on ${this.name}`);
      return true;
    }


    let data = {
      uri: query
    }
    

    try {
      await this.client.get('/api/ap/show', data)

      this.logger.debug(`Fetched ${query} on ${this.name}`); // there's gonna be a LOT of that, so I'm making it debug

      await db.all("INSERT INTO fetched (object, status, instance, type, runTimestamp) VALUES (?, 'success', ?, ?, ?) ON CONFLICT(object,instance) DO UPDATE SET status = 'success', fails = 0", 
        [query, `${this.dbName}`, this.outputName, global.runTimestamp]); // if successful

      this.fetchedCount++;
      if(this.fetchedCount % 20 == 0) this.logger.info(`Progress: ${this.fetchedCount} objects on ${this.name}`);

      return true;
    } catch (e) {
      this.logger.warn(`Error fetching ${query} on ${this.name}; error: ${e}`);

      await db.all("INSERT INTO fetched (object, status, instance, type, runTimestamp) VALUES (?, 'failed', ?, ?, ?) ON CONFLICT(object,instance) DO UPDATE SET status = 'failed', fails = fails + 1", 
        [query, `${this.dbName}`, this.outputName, global.runTimestamp]); // if unsuccessful

      this.errorsCount++;
      return false;
    }
  },
  function () {
    // No cleanup needed
    logger.info(`Fetched ${this.fetchedCount} objects on ${this.name}, ${this.errorsCount} failed`)
    return true;
  },
  async function () {
    // will be called before closing outputs, should retry any failed fetches, return amount of failed fetches

    if(this.errorsCount == 0) return 0;

    this.logger.info(`Retrying ${this.errorsCount} failed fetches on ${this.name}`);



    let errors = [...this.errors];
    this.errors.clear();
    
    let errorsCount = this.errorsCount;
    this.errorsCount = 0;

    for (let item of errors) {
      this.fetch(item);
    }

    return errorsCount;
  }
  
);

module.exports = MastoOutput;