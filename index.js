const YAML = require('yaml');
const axios = require('axios');
const fs = require('fs');
const axiosRetry = require('axios-retry');
const rateLimit = require('axios-rate-limit');

const EventEmitter = require('events');

const { parseDirectives, fetchUserRoutes, getPosts } = require('./functions');

// read config file

const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));
// console.log(config);

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
        'User-Agent': 'masto-backfill/0.1.0 (Contact: +https://plrm.adamski2003.lol/adam)'
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

for (let instance of config.instances) {
  console.log(`Adding output instance ${instance}`)
  outputInstances[instance] = {
    client: rateLimit(
      axios.create({
        baseURL: `https://${instance.instance}`,
        timeout: 20000,
        headers: {
          'User-Agent': 'masto-backfill/0.1.0 (Contact: +https://plrm.adamski2003.lol/adam)',
          'Authorization': 'Bearer ' + instance.token,
        }
      }),
      { 
        maxRPS: 5
      }
    ),
  };

  axiosRetry(outputInstances[instance].client, {
    retries: 5,
    shouldResetTimeout: true,
    retryDelay: axiosRetry.exponentialDelay
  });

  outputInstances[instance].instance = instance.instance;
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

events.on('newPosts', (posts) => {

  for (let instance in outputInstances) {
    console.log(`Fetching ${posts.length} posts on ${outputInstances[instance].instance}`)

    for (let post of posts) {

      let params = new URLSearchParams();
      params.append("q", post);
      params.append('resolve', true);

      // console.log(params.toString());

      // /*
      outputInstances[instance].client.get('/api/v2/search' + `?${params.toString()}`)
      .then((response) => {
        console.log(`Fetched ${post} on ${outputInstances[instance].instance}`);
      })
      .catch((error) => {
        console.log(error);
      })
      // */


    }

  }
  //console.log(posts);

})



console.time('fetchUserRoutes')
fetchUserRoutes(requests, events);