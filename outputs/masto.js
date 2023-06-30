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

// This output fetches posts on a Mastodon(-compatible) instance directly via the API

const MastoOutput = new OutputInterface(
  'masto',
  function (name, logger, options, globalOptions) {

    this.name = name;
    this.logger = logger.child({ output: 'masto', instance: name });
    if(options?.logLevel) this.logger.level = options.logLevel;

    if(!options.token) {
      throw new Error('No token provided for Mastodon instance ' + name);
    }

    let client = rateLimit(
      axios.create({
        baseURL: `https://${name}`,
        timeout: options?.timeout || 15000,
        headers: {
          'User-Agent': options?.userAgent || 'masto-backfill/1.0.0' + (globalOptions?.contact ? `; +${globalOptions.contact}` : ''),
          'Authorization': 'Bearer ' + options.token,
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

    this.fetched = new Set();
    this.errors = new Set();

    return this;
  },
  async function (query, options) {

    if(this.fetched.has(query)) {
      this.logger.debug(`Already fetched ${query} on ${this.name}`);
      return true;
    }

    let params = new URLSearchParams();
    params.append("q", query);
    params.append('resolve', true);

    try {
      await this.client.get('/api/v2/search' + `?${params.toString()}`)
      this.logger.debug(`Fetched ${query} on ${this.name}`); // there's gonna be a LOT of that, so I'm making it debug
      this.fetched.add(query);
      return true;
    } catch (e) {
      this.logger.info(`Error fetching ${query} on ${this.name}; error: ${e}`);
      this.errors.add(query);
      return false;
    }
  },
  function () {
    // No cleanup needed
    return true;
  }
  
);

module.exports = MastoOutput;