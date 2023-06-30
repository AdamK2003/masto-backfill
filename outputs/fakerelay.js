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

// This output fetches posts via a FakeRelay (https://github.com/g3rv4/FakeRelay/) instance

const FakeRelayOutput = new OutputInterface(
  'fakerelay',
  function (name, logger, options, globalOptions) {

    this.name = name;
    this.instanceName = options.instance;
    this.logger = logger.child({ output: this.outputName, name: name });
    if(options?.logLevel) this.logger.level = options.logLevel;

    this.logger.trace(`Creating FakeRelay instance ${name} with options ${JSON.stringify(options)}`);


    if(!options.instance) {
      throw new Error('No instance provided for FakeRelay instance ' + name);
    }
    if(!options.token) {
      throw new Error('No token provided for FakeRelay instance ' + name);
    }

    let client = rateLimit(
      axios.create({
        baseURL: `https://${options.instance}`,
        timeout: options?.timeout || 20000,
        headers: {
          'User-Agent': options?.userAgent || 'masto-backfill/1.0.0' + (globalOptions?.contact ? `; +${globalOptions.contact}` : ''),
          'Authorization': 'Bearer ' + options.token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        }
      }),
      { 
        maxRPS: options?.maxRPS || 5
      }
    );
  
    axiosRetry(client, {
      retries: 5,
      shouldResetTimeout: true,
      retryDelay: axiosRetry.exponentialDelay
    })

    this.client = client;

    this.fetched = new Set();
    this.errors = new Set();
    this.fetchedCount = 0;
    this.errorsCount = 0;

    return this;
  },
  async function (query, options) {

    if(this.fetched.has(query)) {
      this.logger.debug(`Already fetched ${query} on ${this.name}`);
      return true;
    }

    if(query.startsWith('@')) {
      this.logger.debug(`User fetching not supported on ${this.name}`);
      return false;
    }
    

    try {


      

      let params = new URLSearchParams();
      params.append('statusUrl', query);

      await this.client.post('/index', params.toString());
      

      this.logger.debug(`Fetched ${query} on ${this.name}`); // there's gonna be a LOT of that, so I'm making it debug
      this.fetched.add(query);
      this.fetchedCount++;
      if(this.fetchedCount % 20 == 0) this.logger.info(`Progress: ${this.fetchedCount} posts on ${this.name}`);
      return true;
    } catch (e) {
      this.logger.warn(`Error fetching ${query} on ${this.name}; error: ${e}`);
      this.errors.add(query);
      this.errorsCount++;
      return false;
    }
  },
  function () {
    // No cleanup needed
    return true;
  }
  
);

module.exports = FakeRelayOutput;