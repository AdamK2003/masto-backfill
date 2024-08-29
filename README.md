# masto-backfill

This tool fetches posts from Mastodon (or Mastodon-compatible) instances and uses the search endpoint to make your instance fetch them, making them searchable and fixing incomplete user pages.

## Why?

I created my instance about a week ago, and I wanted to see old posts on some users' pages. I found some tools (like [FediFetcher](https://github.com/nanos/FediFetcher) and [GetMoarFediverse](https://github.com/g3rv4/GetMoarFediverse)), but none of them worked for my use case, so I decided to make my own.

## How does it work?

The tool fetches the specified timelines from the specified instances, extracts the post URLs and user tags and then uses the search endpoint on the target instance(s) with `resolve=true` to force the instance(s) to fetch the posts. Everything is done asynchronously and in parallel to avoid wasting time with ratelimits on separate instances.

## Warning

This WILL spam the output instances with requests and probably will take some time to complete if you're fetching a lot of posts. It pegged all the CPU cores on the Oracle VM I'm running my own Pleroma instance on when I was testing the tool with a 3rps ratelimit, so keep that in mind. Please only run it on your own instance or with the permission of the instance admins. I'm not responsible for any damage caused by this tool.

I highly recommend using the `fakerelay` output instead of `masto` if you have the means; the search endpoint used in `masto` fetches the post synchronously, while relayed posts from FakeRelay are fetched asynchronously and are deferred if the load is too high.

(The input instances should be fine, they get much less requests and (more importantly) the requests are only for reading data, while the requests on the output instances actually cause (lots of) database updates.)

## How to use?

- Make sure you have [Node.js](https://nodejs.org/) 18 or newer installed (slightly older versions might work, but I haven't tested them)
- Clone the repository and run `npm i` to install the dependencies
- Copy `template.config.yml` to `config.yml` and edit it (you can get a token [here](https://getauth.thms.uk/?scopes=read&client_name=masto-backfill))
- Run `node index.js` or `npm run start`
- Watch the magic happen

## How to configure?

The config is a [YAML file](https://yaml.org/spec/1.2.2/) containing output definitions, directives for groups of instances and timelines and directives for users. Public or tag timelines are specified in the `directives` array with instance domains, while users are specified separately in the `users` array. The syntax for directives is `timeline/user:amount:filter1:filter2:...`, where `timeline/user` is the `$public` timeline or a `tag`, or in the case of a user, a `@username@instance.tld`. `amount` is optional and is the amount of posts to fetch, can be omitted even if you're using filters (`timeline:filter1:filter2...` will work). Defaults to 40. The filters are also optional; they're different for each timeline type and are listed in the next section. The filters are applied in the order they're written in the config file. In case of conflicting filters, the last one will be used unless specified otherwise. You can have as many directives as you want; just keep in mind that fetching the posts on your target output(s) might take some time. If fetching a timeline fails, it will be skipped and a warning will be logged.

The recommended configuration is a `masto` output with post fetching disabled and a `fakerelay` output (which can't fetch users) if you can get a fakerelay instance running. If you can't, use a `masto` output with both post and user fetching enabled (unless you don't want either of those, of course) and a low enough ratelimit (run `htop` or something similar on the server to see how much CPU usage the script is causing or watch the failure rates on fetches (usually timeouts, which are `ECONNABORTED` in the log) and adjust the ratelimit accordingly).

The program can (and, by default will) use a persistent SQLite3 database to store the fetched post URLs and user tags. This is useful if you want to run the program multiple times without fetching the same posts again. By default, the database is stored as `posts.db` in the current working directory, but you can change that in the config file. If you want to disable the database, set the database path to `:memory:` - this will cause the database to be stored in memory and discarded when the program exits.

The database is always used by the outputs, but you can also enable skipping already fetched posts while fetching posts from the input instances by setting `input.skip` to true and adding the outputs you want to skip to `input.skipInstances`. Example: if you have a directive with a timeline argument `$public:100`, but your instance already has 50 posts, the program will fetch 100 posts from the input instances and 50 posts will be fetched on the output instances with `skip` disabled, while if it's enabled, it'll fetch at least 150 posts from the input instances to make sure that 100 new posts are fetched on the output instances.

## Outputs

Here's a list of outputs you can use:

`type: masto` - Mastodon-compatible instances - example config:

```yaml
outputs:
  - type: masto
    enabled: true # optional, defaults to true, works on all outputs, can be used to disable an output without removing it from the config/commenting it out
    name: your.instance.tld # required, instance domain (without scheme)
    options:
      token: "your token here" # required, token for the instance (`resolve` on the search endpoint doesn't work without the token)
      maxRPS: 3 # optional, change depending on what your instance can handle, defaults to 3
      posts: true # optional, defaults to true, whether to fetch posts, setting to false can be useful if you're also using fakerelay (which only supports fetching posts)
      users: true # optional, defaults to true, whether to fetch users
```

`type: fakerelay` - [FakeRelay](https://github.com/g3rv4/FakeRelay/) instance, highly recommended over the `masto` output if you have the means to run it (see Warning section above), can't fetch users - example config:

```yaml
- type: fakerelay
    name: "fakerelay!your.instance.tld" # can be anything, the domain is in options because some people might want to use multiple tokens on the same relay
    options:
      instance: fakerelay.domain.tld # required, your FakeRelay domain
      token: "yourTokenHere" # required, your FakeRelay API key for the desired instance
      maxRPS: 5 # default for FakeRelay is 5, you can probably go higher than with a `masto` output on the same server
```

`type: log` - log to the console - example config:

```yaml
outputs:
  - type: log
    name: logOutput # required, but can be anything, will be used to identify the output in the logs
    options:
      logLevel: info # this actually works on all outputs, but it's especially useful for the log output
```

`type: json` - write to a JSON file - example config:

```yaml
outputs:
  - type: json
    name: jsonOutput # required, but can be anything, will be used to identify the output in the logs
    options:
      file: ./output.json # required, path to the JSON file
```

## Filters

Here's a list of filters you can use:

- `local`, `remote` (`$public` and tags) - only fetch local/remote posts, when both are set, the script will behave as if neither were set (and fetch all posts)
- `+tag` (tags only) - only fetch posts with this tag, example: `+art`, multiple `+tag` filters can be used and will behave as an AND
- `?tag` (tags only) - only fetch posts with this tag, example: `?art`, multiple `?tag` filters can be used and will behave as an OR
- `-tag`/`!tag` (tags only) - only fetch posts without this tag, example: `-nsfw`, multiple `-tag` filters can be used and will behave as a NOR
- `maxId=1337` (everything) - only fetch posts with an ID lower than the specified one
- `sinceId=1337` (everything) - only fetch posts with an ID higher than the specified one ("newer than ID") - if both this and `minId` are specified, `minId` will be used
- `minId=1337` (everything) - only fetch posts with an ID higher than the specified one ("immediately newer than ID") - if both this and `sinceId` are specified, `minId` will be used
- `+tag` (users only) - only fetch posts with this tag, example: `+art`, you can only use a SINGLE `+tag` filter on a user timeline
- `-replies`/`!replies` (users only) - only fetch posts that are not replies
- `-reblogs`/`!reblogs` (users only) - only fetch posts that are not repeats
