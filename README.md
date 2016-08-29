# Network Health Monitor

Installation:

1. Create a [github token](https://github.com/settings/tokens) with the Gist permission
2. Create a new [gist](https://gist.github.com/) and copy its ID from the URL (https://gist.github.com/[user]/[id])
3. Install [Node.js](https://nodejs.org/en/) (version 6+)
4. Run `npm install` in this directory
5. Copy `.env.example` to `.env` and set values from steps 1 and 2
6. Run `node index.js` to ensure it works
7. Set up a cron job to run as necessary