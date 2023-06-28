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



const getPosts = async (requests, eventEmitter) => {

  let posts = [];

  for (let instance in requests) {

    for (let request in requests[instance].requests) {

      // console.log(requests[instance].requests[request])

      getTimelinePosts(instance, requests[instance].requests[request], requests[instance].client, eventEmitter);

      // add posts to posts array

      // posts = posts.concat(timelinePosts);

    }

  }

  // deduplicate posts

  posts = Array.from(new Set(posts))


}




const getTimelinePosts = async (instance, request, client, eventEmitter) => {


  let path = request.path;
  let count = request.count;

  // figure out parameters

  let params = request.params;

  // console.log(params);

  const reservedKeys = [
    'max_id'
  ]

  let preservedParams = params.filter(p => !reservedKeys.includes(p.key));
  let preservedParamsStr = preservedParams.map(p => `${p.key}=${p.value}`).join('&');

  


  let otherParams = params.filter(p => reservedKeys.includes(p.key));

  

  

  // console.log(preservedParams);
  // console.log(otherParams);

  // max id will be used to paginate

  let maxId = undefined;

  if(otherParams.find(p => p.key === 'max_id')) {
    maxId = otherParams.find(p => p.key === 'max_id').value;
  }

  
  getNextPage(instance, path, preservedParamsStr, client, maxId, count, eventEmitter);

  // console.log(maxId);



}


const getNextPage = async (instance, path, params, client, maxId, count, eventEmitter) => {


  let url = `${path}`;
  if(params) {
    url += `&${params}`;
  }
  if(maxId) {
    url += `&max_id=${maxId}`;
  }
  url = url.replace('&', '?');

  console.log(`${count} posts remaining on ${instance}${path}`);

  let response;
  
  try {
    response = await client.get(url);
  } catch (e) {
    console.log(`Could not get ${url} for ${instance}`);
    return null;
  }

  // console.log(response.data[response.data.length - 1]);

  let posts = [];

  for (let post of response.data) {
    posts.push(post.url);
  }

  if(posts.length === 0) {
    console.log(`No more posts found on ${instance}${path}`);
    return;
  }

  // console.log(posts);

  if(posts.length > count) {
    posts = posts.slice(0, count);
  }

  let newCount = count - posts.length;

  let lastId = response.data[response.data.length - 1].id;

  eventEmitter.emit('newPosts', posts);


  if(newCount <= 0) return;

  getNextPage(instance, path, params, client, lastId, newCount, eventEmitter);
  
  
}



module.exports = getPosts;