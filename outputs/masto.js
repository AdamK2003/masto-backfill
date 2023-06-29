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

const MastoOutput = new OutputInterface(
  'masto',
  function (instance, options) {
    if(!options.token) {
      throw new Error('No token provided for Mastodon instance ' + instance);
    }
    this.name = instance;
    this.instance = instance;
    let client = rateLimit(
      axios.create({
        baseURL: `https://${instance}`,
        timeout: options?.timeout || 15000,
        headers: {
          'User-Agent': options?.userAgent || 'masto-backfill/1.0.0',
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
    return this;
  },
  async function (query, options) {

    let params = new URLSearchParams();
      params.append("q", query);
      params.append('resolve', true);

      try {
        await this.client.get('/api/v2/search' + `?${params.toString()}`)
        console.log(`Fetched ${query} on ${this.name}`);
        return true;
      } catch (e) {
        console.log(`Error fetching ${query} on ${this.name}; error: ${e}`);
        return false;
      }

  }
);

module.exports = MastoOutput;