# Swearington

Swearington will monitor the chat for swears or banned words. Administrators can add or remove words from an initially empty list. If a word in the chat matches a term that Swearington is watching for, then Swearington will add a point to that user's count to track how many times a user has said a "banned" word.

## Features

- Create your own terms list. The terms list starts off empty and can be updated via Discord slash commands or manually through the terms file on the server side.
  - Terms lists can be created one term at a time, with an existing list, or with an existing list file.
- Administrators have access to update points and update terms.
- Users can check how many points they or someone else has.
- Set up as a service architecture with Docker Compose using a published Docker container and PostgreSQL.
- Points tracking works per server per user, so an individual will have separate point tracking for each server they are in.
- Terms are stored on a per server (guild) basis. This means specific terms can be added to one server but not seen or used in another.
- Simplistic swear checking. A message is broken down into words split by spaces. If the word matches a term, then a point will be added.

## Commands

- /points [user]-Optional
  - Check the amount of points a user has, if no user is supplied then it will return the requestors point count.
- /addpoint [user]
  - Manually add a point to a user.
- /removepoint [user]
  - Manually remove a point from a user.
- /addterm [term]
  - Add a term to the "banned" words list. 
- /removeterm [term]
  - Remove a term from the "banned" words list.
- /addtermslist [term, term, term, ...]
  - Add a list of terms that are comma separated.
- /removetermslist [term, term, term, ...]
  - Remove a list of terms that are comma separated.
- /addtermsfile [file]
  - Add a list of terms from a Comma Separated Values (CSV) file.
- /removetermsfile [file]
  - Remove a list of terms from a Comma Separated Values (CSV) file.
- /setpoints [user] [count]
  - Set a users points to a specific count.
- /listterms
  - List the terms within the "banned" words list.
- /version
  - Check the version of the app.

## Setup

The Docker Compose setup will use the published app from Docker Hub and a PostgreSQL server to run the Discord bot. You will need to acquire your Discord Token so the bot can login. The Discord Token should be stored in a *.env* file next to the docker compose file. 

### To Add the Bot to a Server

After you've acquired the token and you have the bot running, you will need to add the bot to the server with the proper permissions.

- Under OAuth2
  - Under OAth2 URL Generator
    - Select bot
  - Under Bot Permissions
    - View Channels
    - Send Messages
    - Send Messages in Threads
    - Attach Files
    - Read Message History
  - Copy the generated URL at the bottom and paste it into the browser.

## Backup

Backup the database:

```bash
docker exec -t swearjar pg_dumpall -U swearington > swearington_db_backup_$(date +"%Y%m%d_%H%M%S").sql
```

Backup the app data:

```bash
tar -czvf swearington_app_backup_$(date +"%Y%m%d_%H%M%S").tar.gz app-data
```

## Restore

Copy the backup into the docker container:

```bash
docker cp swearington_db_backup_<timestamp>.sql swearjar:/var/lib/postgresql/data/backup.sql
```

Drop and re-create the database:

```bash
docker exec swearjar dropdb swearington -U swearington
docker exec swearjar createdb swearington -U swearington
```

Restore the database:

```bash
psql -U swearington -f /var/lib/postgresql/data/backup.sql -d swearington
```

Extract the app data next to the docker compose file:

```bash
tar -xzvf swearington_app_backup_<timestamp>.tar.gz app-data
```

## Later

- Regex for common words and filtering?
- Can I do something for context and intent analysis? Toxicity scoring? Kinda expensive init?

## Development

This has been tested in Ubuntu 24.04 and required Docker to be installed.

The [toolage](./toolage.sh) script offers helpful commands for building, running, and publishing.