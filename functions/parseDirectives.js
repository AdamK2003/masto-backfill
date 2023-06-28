
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