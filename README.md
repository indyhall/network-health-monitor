# Network Health Monitor

This CLI application is meant to periodically run and check the health of your network.

## Installation:
 
1. Copy `config.example.json` to `config.json` and update accordingly.
2. Make sure you have [Node.js 6.0.0+](https://nodejs.org/en/) installed w/ `npm`
3. Run `npm install` in this directory
4. Run `node index.js` to ensure it works
5. Set up a cron job to run as necessary (something like `*/10 * * * * cd /path/to/repo && /usr/local/bin/node index.js`)

### Targets

The health monitor is designed to upload stats to targets. [Cachet](https://cachethq.io/) is included
by default, but it should be fairly simple to add your own target. To set up Cachet, first
[follow the installation instructions](https://docs.cachethq.io/docs/installing-cachet) and then set up the
metrics you want to track. Take note of each metric ID.

Once Cachet is set up, update `config.json`. Fields ending in `_id` should be filled with the Cachet metric 
ID associated with that value. For example, if you want to track your upload speed, fill the `tests.speed.up_id` 
value with the metric ID from Cachet.