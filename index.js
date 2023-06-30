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


const YAML = require('yaml');
const axios = require('axios');
const fs = require('fs');
const axiosRetry = require('axios-retry');
const rateLimit = require('axios-rate-limit');

const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));

logger = require('pino')({
  level: config.global?.logLevel || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname'
    }
  }
})

const EventEmitter = require('events');

const { parseDirectives, fetchUserRoutes, getPosts } = require('./functions');
const outputGenerators = require('./outputs');

// read config file



let requests = parseDirectives(config.directives, config.users, logger);
// TODO add filtering by date, ~~IDs are snowflakes so we can use the timestamp~~ nvm, the IDs are not guaranteed to be snowflakes


// generate an axios client for each instance
// use axios-retry and axios-rate-limit

for (let instance in requests) {
  requests[instance].client = rateLimit(
    axios.create({
      baseURL: `https://${instance}`,
      timeout: 10000,
      headers: {
        'User-Agent': 'masto-backfill/1.0.0' + (config.global?.contact ? `; +${config.global.contact}` : '')
      }
    }),
    { 
      maxRPS: config.global.inputMaxRPS || 1
    }
  );

  axiosRetry(requests[instance].client, {
    retries: 3,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => { return retryCount * 1000 } // axiosRetry.exponentialDelay
  });
}

let outputs = {};

for (let output of config.outputs) {

  if(output.enabled === false) {
    logger.info(`Skipping disabled output ${output.name}`)
    continue;
  }

  logger.info(`Adding output ${output.name}`)
  let outputType = outputGenerators[output.type];

  outputs[`${output.type}-${output.name}`] = outputType.init(output.name, logger, output.options, config.global);

}



const events = new EventEmitter();


fetchUserRoutes(requests, events, logger);


events.on('fetchUserRoutesComplete', (requestsOutput) => {
  requests = requestsOutput;
  
  getPosts(requests, events, logger);
  
})



events.on('newFetchables', (posts) => {

  for (let output in outputs) {
    logger.debug(`Fetching ${posts.length} objects on ${outputs[output].name}`)

    for (let post of posts) {
      
      outputs[output].fetch(post)

    }

  }
  //logger.info(posts);

})






let closed = false;
let failed = false;
let retries = config.global?.closeRetries || 3;

process.on('beforeExit', async () => {

  failed = false;
  if(closed) return;
  logger.info('Closing outputs')

  for (let output in outputs) {
    let success = outputs[output].close();
    if(!success) {
      failed = true;
      logger.warn(`Failed to close output ${outputs[output].name}`)
    } 
  }

  if(failed) {
    logger.warn(`Failed to close some outputs, ${retries} retries remaining`)
    retries--;
    if(retries > 0) {
      logger.warn('Retrying')
      process.emit('beforeExit')
    } else {
      logger.error('Failed to close outputs, exiting')
      process.exit(1)
    }
  }


  logger.info('Outputs closed')
  closed = true

})