# Network Health Monitor

Installation:

1. Set up metrics in Cachet
2. Copy `.env.example` to `.env` and set secret values 
3. Copy `config.example.json` to `config.json` and update accordingly. Fields ending in `_id`
   should be filled with the Cachet metric ID associated with that value. For example, if you
   want to track your upload speed, fill the `speed.up_id` value with the metric ID from Cachet.
4. Install [Node.js](https://nodejs.org/en/) (version 6+)
5. Run `npm install` in this directory
6. Run `node index.js` to ensure it works
7. Set up a cron job to run as necessary