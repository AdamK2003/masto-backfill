
// fetch user IDs and generate requests

const fetchUserRoutes = async (requests, eventEmitter) => {

  let requestsOutput = requests;

  for (let instance in requests) {
    
    for (let request in requests[instance].requests) {

      if (requests[instance].requests[request].type === 'user') {

        let requestPath = requests[instance].requests[request].path;
        let requestParams = requests[instance].requests[request].params;

        let paramsString = '';

        for (let param of requestParams) {
          paramsString += `&${param.key}=${param.value}`;
        }
        paramsString = paramsString.replace('&', '?');

        console.log(`${instance}${requestPath}${paramsString}`);

        let response;

        try {
          response = await requests[instance].client.get(requestPath + paramsString)
        } catch(err) {
          // if 404, remove request
          if (err.response.status === 404) {
            console.log(`404 on ${instance}${requestPath}${paramsString}`)
            delete requestsOutput[instance].requests[request];
            continue;
          }
          console.log(err);
        }

        // console.log(response.data);

        let newPath = `/api/v1/accounts/${response.data.id}/statuses`;
        let newMethod = 'GET';
        let newParams = requestParams.filter(p => p.key !== 'acct');

        requestsOutput[instance].requests[request].path = newPath;
        requestsOutput[instance].requests[request].method = newMethod;
        requestsOutput[instance].requests[request].params = newParams;
        requestsOutput[instance].requests[request].type = 'userFetched';
        

      }

    }

  }

  // console.log(requestsOutput);

  eventEmitter.emit('fetchUserRoutesComplete', requestsOutput);
  return requestsOutput;

}

module.exports = fetchUserRoutes;