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


global.timelineObjectCache = {};

function parseSingleTimeline(timeline, instanceDomain) {
  if(global.timelineObjectCache[timeline]) {
    return global.timelineObjectCache[timeline];
  }

  let segments = timeline.split(":");

  let output = {
    apiPath: undefined,
    apiMethod: undefined,
    params: [],
    count: undefined,
  }


  let timelineId = segments[0];
  let count = !isNaN(+segments[1]) ? +segments[1] : 40;
  let filters = segments.slice(1 + !isNaN(+segments[1]));

  // console.log(timelineId, count, filters);

  

  if(timelineId == '$public') {
    output.apiPath = '/api/v1/timelines/public';
    output.apiMethod = 'GET';
  } else {
    output.apiPath = `/api/v1/timelines/tag/${timelineId}`;
    output.apiMethod = 'GET';
  }

  let filterObject = {
    local: false,
    remote: false,
    tagsOr: [],
    tagsAnd: [],
    tagsNot: [],
    maxId: undefined,
    minId: undefined,
    sinceId: undefined
  }

  // long, ugly block of code, fixme? takes care of filter parsing
  for (filter of filters) {

    if(filter.startsWith('+')) {

      if(filterObject.tagsOr.includes(filter.slice(1))) {
        filterObject.tagsOr = filterObject.tagsOr.filter(tag => tag != filter.slice(1))
      }

      if(filterObject.tagsNot.includes(filter.slice(1))) {
        filterObject.tagsNot = filterObject.tagsNot.filter(tag => tag != filter.slice(1))
      }

      filterObject.tagsAnd.push(filter.slice(1))
    } else if(filter.startsWith('-')) {

      if(filterObject.tagsOr.includes(filter.slice(1))) {
        filterObject.tagsOr = filterObject.tagsOr.filter(tag => tag != filter.slice(1))
      }

      if(filterObject.tagsAnd.includes(filter.slice(1))) {
        filterObject.tagsAnd = filterObject.tagsAnd.filter(tag => tag != filter.slice(1))
      }

      filterObject.tagsNot.push(filter.slice(1))
    } else if(filter.startsWith('?')) {

      if(filterObject.tagsNot.includes(filter.slice(1))) {
        filterObject.tagsNot = filterObject.tagsNot.filter(tag => tag != filter.slice(1))
      }

      if(filterObject.tagsAnd.includes(filter.slice(1))) {
        filterObject.tagsAnd = filterObject.tagsAnd.filter(tag => tag != filter.slice(1))
      }

      filterObject.tagsOr.push(filter.slice(1))
    }

    if(filter == 'local' && !filters.includes('remote')) {
      filterObject.local = true;
    } else if(filter == 'remote' && !filters.includes('local')) {
      filterObject.remote = true;
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

  if(filterObject.local) {
    output.params.push({
      key: 'local',
      value: true
    })
  }

  if(filterObject.remote) {
    output.params.push({
      key: 'remote',
      value: true
    })
  }

  if(filterObject.tagsOr.length > 0) {
    for (tag of filterObject.tagsOr) {
      output.params.push({
        key: 'any[]',
        value: tag
      })
    }
  }

  if(filterObject.tagsAnd.length > 0) {
    for (tag of filterObject.tagsAnd) {
      output.params.push({
        key: 'all[]',
        value: tag
      })
    }
  }

  if(filterObject.tagsNot.length > 0) {
    for (tag of filterObject.tagsNot) {
      output.params.push({
        key: 'none[]',
        value: tag
      })
    }
  }



  output.count = count;



  global.timelineObjectCache[timeline] = output;

  return output;



}



module.exports = parseSingleTimeline;