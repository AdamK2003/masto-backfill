global.timelineObjectCache = {};

function parseUserDirective(timeline) {
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
  // console.log(userTag);

  
  
  let userName = userTag.split('@')[0 + userTag.startsWith('@')];
  let instanceDomain = userTag.split('@')[1 + userTag.startsWith('@')];

  output.instanceDomain = instanceDomain;

  // console.log(userName, instanceDomain);

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

  output.count = count;

  // console.log(output);

  return output;


}



module.exports = parseUserDirective;