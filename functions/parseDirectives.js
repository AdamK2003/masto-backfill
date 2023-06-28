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


const parseSingleTimeline = require('./parseSingleTimeline')
const parseUserDirective = require('./parseUserDirective')



const parseDirectives = (directives, users) => {


  let output = {};

  /* each entry will be an object with schema:
  "${instanceDomain}": { // domain, for example "mastodon.social"
    client: null, // will be created later
    requests: [
      {
        type: "${type}", // for example "timeline"
        path: "${apiPath}", // for example "/api/v1/timelines/home"
        method: "${apiMethod}", // probably GET
        params: [
          {
            key: "${paramKey}", // for example "local"
            value: "${paramValue}" // for example true
          }, ...
        ]
        count: ${count} // the max amount of posts to fetch
      }
    ]
  }
  
  */
  if(!directives) directives = []
  if(!users) users = []
  for (let directive of directives) {
    for (let instance of directive.instances) {
      if (!output[instance]) {
        output[instance] = {
          client: null,
          requests: []
        }
      }

      for (timeline of directive.timelines) {

        let request = {
          type: "timeline",
          path: undefined,
          method: undefined,
          params: [],
          count: undefined
        }

        let timelineOutput = parseSingleTimeline(timeline)

        // console.log(timelineOutput);

        request.path = timelineOutput.apiPath;
        request.method = timelineOutput.apiMethod;
        request.params = timelineOutput.params;
        request.count = timelineOutput.count;

        // if an entry for this instance and path exists, update the params and count
        let existingRequest = output[instance].requests.find(r => r.path === request.path);
        if (existingRequest) {
          existingRequest.params = request.params;
          existingRequest.count = request.count;
        }
        // otherwise, add a new entry
        else {
          output[instance].requests.push(request);
        }

      }

      


    }
  }

  for (let user of users) {



    let request = {
      type: "user",
      path: undefined,
      method: undefined,
      params: [],
      count: undefined,
      user: undefined
    }

    let userOutput = parseUserDirective(user)
    // console.log(userOutput)

    request.path = userOutput.apiPath;
    request.method = userOutput.apiMethod;
    request.params = userOutput.params;
    request.count = userOutput.count;
    request.user = userOutput.user;

    let instance = userOutput.instanceDomain;

    if (!output[instance]) {
      output[instance] = {
        client: null,
        requests: []
      }
    }

    // console.log(request);

    // if an entry for this instance and path exists, update the params and count

    let existingRequest = output[instance].requests.find(r => r.path === request.path && r.user === request.user);
    if (existingRequest) {
      existingRequest.params = request.params;
      existingRequest.count = request.count;
    }
    // otherwise, add a new entry
    else {
      output[instance].requests.push(request);
    }

  }

  // console.log(JSON.stringify(output, null, 2))
  return output;

}



module.exports = parseDirectives;