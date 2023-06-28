# masto-backfill

This tool fetches posts from Mastodon (or Mastodon-compatible) instances and uses the search endpoint to make your instance fetch them, making them searchable and fixing incomplete user pages.

## How to use?

- Clone the repository and run `npm i` to install the dependencies
- Copy `config.template.yml` to `config.yml` and edit it
- Run `node index.js` or `npm run start`
- Watch the magic happen

## How to configure?

The config is a [YAML file](https://yaml.org/spec/1.2.2/) containing instance(s) to fetch posts on, together with tokens, directives for groups of instances and timelines and directives for users. Public or tag timelines are specified in the `directives` array with instance domains, while users are specified separately in the `users` array. The syntax for directives is `timeline/user:amount:filter1:filter2:...`, where `timeline/user` is the `$public` timeline or a `tag`, or in the case of a user, a `@username@instance.tld`. `amount` is optional and is the amount of posts to fetch, can be omitted even if you're using filters (`timeline:filter1:filter2...` will work). Defaults to 40. The filters are also optional; they're different for each timeline type and are listed in the next section. The filters are applied in the order they're written in the config file. In case of conflicting filters, the last one will be used unless specified otherwise. You can have as many directives as you want; just keep in mind that fetching the posts on your target instance(s) might take some time. If fetching a timeline fails, it will be skipped and a warning will be logged.

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
