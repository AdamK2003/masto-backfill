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