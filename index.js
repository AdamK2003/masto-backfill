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

const EventEmitter = require('events');

const { parseDirectives, fetchUserRoutes, getPosts } = require('./functions');
const outputs = require('./outputs');

// read config file

const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));


console.time('parseDirectives')
let requests = parseDirectives(config.directives, config.users);
// TODO add filtering by date, IDs are snowflakes so we can use the timestamp
console.timeEnd('parseDirectives')

// console.log(JSON.stringify(requests, null, 2));

// generate an axios client for each instance
// use axios-retry and axios-rate-limit

for (let instance in requests) {
  requests[instance].client = rateLimit(
    axios.create({
      baseURL: `https://${instance}`,
      timeout: 10000,
      headers: {
        'User-Agent': 'masto-backfill/1.0.0'
      }
    }),
    { 
      maxRequests: 2,
      perMilliseconds: 1000,
      maxRPS: 1
    }
  );

  axiosRetry(requests[instance].client, {
    retries: 3,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => { return retryCount * 1000 } // axiosRetry.exponentialDelay
  });
}

let outputInstances = {};

for (let output of config.outputs) {
  console.log(`Adding output ${output.name}`)
  let outputType = outputs[output.type];

  outputInstances[output.instance] = outputType.init(output.name, output.options);



}



const events = new EventEmitter();




events.on('fetchUserRoutesComplete', (requestsOutput) => {
  console.timeEnd('fetchUserRoutes')
  // console.log('fetchUserRoutesComplete');
  requests = requestsOutput;
  console.time('getPosts')
  getPosts(requests, events);
  console.timeEnd('getPosts')
})

let fetchedPosts = {}
let fetchedUsers = {}

events.on('newPosts', (posts) => {

  for (let instance in outputInstances) {
    console.log(`Fetching ${posts.length} posts on ${outputInstances[instance].instance}`)

    for (let post of posts) {

      if(!fetchedPosts[instance.instance]) fetchedPosts[instance.instance] = [];

      if(fetchedPosts[instance.instance].includes(post)) {
        console.log(`Skipping ${post} on ${outputInstances[instance].instance} as it has already been fetched`)
        continue;
      }

      
      outputInstances[instance].fetch(post)



      fetchedPosts[instance.instance].push(post);


    }

  }
  //console.log(posts);

})

events.on('newUsers', (users) => {

  for (let instance in outputInstances) {
    console.log(`Fetching ${users.length} posts on ${outputInstances[instance].instance}`)

    for (let user of users) {
      
      if(!fetchedUsers[instance.instance]) fetchedUsers[instance.instance] = [];

      if(fetchedUsers[instance.instance].includes(user)) {
        //console.log(`Skipping ${user} on ${outputInstances[instance].instance} as it has already been fetched`)
        continue;
      }


      outputInstances[instance].fetch(user)


      fetchedUsers[instance.instance].push(user);


    }

  }
  //console.log(posts);

})


console.time('fetchUserRoutes')
fetchUserRoutes(requests, events);