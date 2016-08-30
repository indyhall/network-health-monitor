# Network Health Monitor

Installation:

1. Set up metrics in Cachet
2. Update `config.json` with domains to check and associated metric IDs
3. Install [Node.js](https://nodejs.org/en/) (version 6+)
4. Run `npm install` in this directory
5. Copy `.env.example` to `.env` and set values from Cachet 
6. Run `node index.js` to ensure it works
7. Set up a cron job to run as necessary