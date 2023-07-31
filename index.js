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

const SQLite3 = require('node-sqlite3') // WHY do I need an extra wrapper for async/await support??

const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));

const dbPath = config.global?.dbPath || './posts.db';

global.runTimestamp = Date.now();

const db = new SQLite3(dbPath)
db.open()




db.run('create table if not exists fetched (object text, status text, instance text, type text, runTimestamp integer, fails integer default 0, constraint pk_obj_inst primary key (object, instance))')

const pino = require('pino');

const transports = pino.transport({
  targets: [
    {
      level: config.global?.logLevel || 'info',
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname'
        }
    },
    {
      level: config.global?.logFileLevel || 'info',
      target: 'pino/file',
      options: {
        destination: './masto-backfill.log',
      }
      
    }
  ]
})

logger = pino(transports)

const EventEmitter = require('events');

const events = new EventEmitter();

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
      timeout: 20000,
      headers: {
        'User-Agent': 'masto-backfill/1.0.0' + (config.global?.contact ? `; +${config.global.contact}` : '')
      }
    }),
    { 
      maxRPS: config.global.inputMaxRPS || 1
    }
  );

  axiosRetry(requests[instance].client, {
    retries: 5,
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

  outputs[`${output.type}-${output.name}`] = outputType.init(output.name, logger, output.options, config.global, db);
  logger.trace(outputs[`${output.type}-${output.name}`])

}







events.on('fetchUserRoutesComplete', (requestsOutput) => {
  logger.trace('fetchUserRoutesComplete')
  
  requests = requestsOutput;
  
  
  
  getPosts(requests, events, logger, db, config.input);
  
})



events.on('newFetchables', (posts) => {
  
  for (let output in outputs) {
    logger.debug(`Fetching ${posts.length} objects on ${outputs[output].name}`)
    
    for (let post of posts) {

      if(!post) {
        logger.debug(`No query provided for ${output}`);
        continue;
      }
      
      outputs[output].fetch(post, db)
      
    }
    
  }
  //logger.info(posts);
  
})



fetchUserRoutes(requests, events, logger);



let closed = false;
let closeFailed = false;
let errorCount = 0;
let fetchRetries = config.global?.fetchRetries || 3;
let closeRetries = config.global?.closeRetries || 3;

process.on('beforeExit', async () => {

  let fetchFailed = false; 

  for (let output in outputs) {

    if(fetchRetries <= 0) break;


    errorCount = await outputs[output].retry(db);


    if(errorCount > 0) {
      logger.warn(`Output ${outputs[output].name} failed to fetch ${errorCount} objects`)
      fetchFailed = true;
    }
  }

  if(fetchFailed && fetchRetries > 0) {
    logger.warn(`Failed to fetch some objects, ${fetchRetries} retries remaining`)
    fetchRetries--;
    return;
  } else if(fetchFailed) {
    logger.error('Failed to fetch some objects, exiting')
  }

  
  closeFailed = false;
  if(closed) return;
  logger.info('Closing outputs')

  
  for (let output in outputs) {
    let success = outputs[output].close();
    if(!success) {
      closeFailed = true;
      logger.warn(`Failed to close output ${outputs[output].name}`)
    } 
  }

  // await db.close();
  
  if(closeFailed) {
    logger.warn(`Failed to close some outputs, ${closeRetries} retries remaining`)
    closeRetries--;
    if(closeRetries > 0) {
      logger.warn('Retrying')
      process.emit('beforeExit')
    } else {
      logger.error('Failed to close outputs, exiting')
      process.exit(1)
    }
  }
  
  
  logger.info('Outputs closed')
  closed = true
  process.exit(0)
  
})

process.on('exit', () => {
  db.close();
})