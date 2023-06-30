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




function parseUserDirective(timeline, loggerInstance) {

  let logger = loggerInstance.child({function: 'parseUserDirective'});

  if(global.timelineObjectCache[timeline]) {
    return global.timelineObjectCache[timeline];
  }

  let segments = timeline.split(":");

  let output = {
    apiPath: undefined,
    apiMethod: undefined,
    params: [],
    count: undefined,
    instanceDomain: undefined,
    user: undefined
  }


  let userTag = segments[0];
  let count = !isNaN(+segments[1]) ? +segments[1] : 40;
  let filters = segments.slice(1 + !isNaN(+segments[1]));

  output.user = userTag;
  // logger.info(userTag);

  
  
  let userName = userTag.split('@')[0 + userTag.startsWith('@')];
  let instanceDomain = userTag.split('@')[1 + userTag.startsWith('@')];

  output.instanceDomain = instanceDomain;

  // logger.info(userName, instanceDomain);

  output.apiPath = `/api/v1/accounts/lookup`;
  output.apiMethod = 'GET';

  output.params.push({
    key: 'acct',
    value: userName
  })

  if(filters.includes('!replies') || filters.includes('-replies')) {
    output.params.push({
      key: 'exclude_replies',
      value: true
    })
  }

  if(filters.includes('!reblogs') || filters.includes('-reblogs')) {
    output.params.push({
      key: 'exclude_reblogs',
      value: true
    })
  }

  let filterObject = {
    tagged: undefined,
    maxId: undefined,
    minId: undefined,
    sinceId: undefined
  }

  for (let filter of filters) {
    if(filter.startsWith('+')) {
      filterObject.tagged = filter.slice(1);
    }

    if(filter.startsWith('maxId=')) {
      filterObject.maxId = filter.split('=')[1];
    }

    if(filter.startsWith('minId=')) {
      filterObject.minId = filter.split('=')[1];
    }

    if(filter.startsWith('sinceId=')) {
      filterObject.sinceId = filter.split('=')[1];
    }

  }

  if(filterObject.tagged) {
    output.params.push({
      key: 'tagged',
      value: filterObject.tagged
    })
  }

  if(filterObject.maxId) {
    output.params.push({
      key: 'max_id',
      value: filterObject.maxId
    })
  }

  if(filterObject.minId) {
    output.params.push({
      key: 'min_id',
      value: filterObject.minId
    })
  }

  else if(filterObject.sinceId) {
    output.params.push({
      key: 'since_id',
      value: filterObject.sinceId
    })
  }

  output.count = count;

  // logger.info(output);

  return output;


}



module.exports = parseUserDirective;