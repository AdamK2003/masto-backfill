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



const getPosts = async (requests, eventEmitter, loggerInstance, db, options) => {

  let logger = loggerInstance.child({function: 'getPosts'});

  let posts = [];

  for (let instance in requests) {

    for (let request in requests[instance].requests) {

      // logger.info(requests[instance].requests[request])

      getTimelinePosts(instance, requests[instance].requests[request], requests[instance].client, eventEmitter, logger, db, options);

      // add posts to posts array

      // posts = posts.concat(timelinePosts);

    }

  }

  // deduplicate posts

  posts = Array.from(new Set(posts))


}




const getTimelinePosts = async (instance, request, client, eventEmitter, loggerInstance, db, options) => {

  let logger = loggerInstance.child({function: 'getTimelinePosts'});


  let path = request.path;
  let count = request.count;

  // figure out parameters

  let params = request.params;

  // logger.info(params);

  const reservedKeys = [
    'max_id'
  ]

  let preservedParams = params.filter(p => !reservedKeys.includes(p.key));
  let preservedParamsStr = preservedParams.map(p => `${p.key}=${p.value}`).join('&');

  


  let otherParams = params.filter(p => reservedKeys.includes(p.key));

  

  

  // logger.info(preservedParams);
  // logger.info(otherParams);

  // max id will be used to paginate

  let maxId = undefined;

  if(otherParams.find(p => p.key === 'max_id')) {
    maxId = otherParams.find(p => p.key === 'max_id').value;
  }

  
  getNextPage(instance, path, preservedParamsStr, client, maxId, count, eventEmitter, logger, db, options, options?.retries || 3);

  // logger.info(maxId);



}


const getNextPage = async (instance, path, params, client, maxId, count, eventEmitter, loggerInstance, db, options, retries) => {

  let logger;

  if(!loggerInstance.function == 'getNextPage') {
    logger = loggerInstance.child({function: 'getNextPage'});
  } else {
    logger = loggerInstance;
  }

  let url = `${path}`;
  if(params) {
    url += `&${params}`;
  }
  if(maxId) {
    url += `&max_id=${maxId}`;
  }
  url = url.replace('&', '?');

  logger.info(`${count} posts remaining on ${instance}${path}`);

  let response;
  
  try {
    response = await client.get(url);
  } catch (e) {
    logger.warn(`Could not get ${url} for ${instance}, error ${e.code}`);
    logger.trace(e)

    if(retries > 0) {
      logger.info(`Retrying ${url} for ${instance} in 5 seconds`);
      setTimeout(() => {
        getNextPage(instance, path, params, client, maxId, count, eventEmitter, logger, db, options, retries - 1);
      }, 5000);
    } else {
      logger.warn(`Could not get ${url} for ${instance} after ${options.retries} retries, skipping`);
    }

     return null;
  }

  // logger.info(response.data[response.data.length - 1]);

  let posts = [];
  let users = [];

  let skipped = false;

  

  for (let post of response.data) {

    let dbPosts = [];

    if(options?.skip) {
      
      let skipInstances = options?.skipInstances



      dbPosts = await db.all("SELECT * FROM fetched WHERE object = ? and instance in (?) and status = 'success'", [post.url, skipInstances.join(',')]);

      logger.trace(dbPosts)

    }

    if(dbPosts.length > 0 && options?.skip) {
      logger.debug(`Skipping ${post.url} on ${instance} as it already exists on ${dbPosts[0].instance}`);
      skipped = true;
      continue;
    }


    posts.push(post.url);
    let user = post.account.acct;
    if(!user.startsWith('@')) {
      user = `@${user}`;
    }
    if((user.split('@').length >= 3)) {
      users.push(user);
    }
  }

  // logger.warn(posts)

  if(posts.length === 0 && !skipped) {
    logger.info(`No more posts found on ${instance}${path}`);
    return;
  }

  // logger.info(posts);

  if(posts.length > count) {
    posts = posts.slice(0, count);
  }

  let newCount = count - posts.length;

  let lastId = response.data[response.data.length - 1].id;

  let fetchables = posts.concat(users);

  eventEmitter.emit('newFetchables', fetchables);
  


  if(newCount <= 0) return;

  getNextPage(instance, path, params, client, lastId, newCount, eventEmitter, logger, db, options, options.retries || 3);
  
  
}



module.exports = getPosts;