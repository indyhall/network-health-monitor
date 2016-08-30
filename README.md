# Network Health Monitor

Installation:

1. Set up metrics in Cachet
2. Update `config.json` with domains to check and associated metric IDs
3. Install [Node.js](https://nodejs.org/en/) (version 6+)
4. Run `npm install` in this directory
5. Copy `.env.example` to `.env` and set values from Cachet 
6. Run `node index.js` to ensure it works
7. Set up a cron job to run as necessary

Running at an interval:

1. Run `which node` and save the output
2. Update `org.indyhall.networkmonitor.plist` replacing "node" in the `ProgramArguments` with the output of step 1, and "index.js" with the full path to the `index.js` file in this directory.
3. Copy `org.indyhall.networkmonitor.plist` to `/Library/LaunchAgents/`
4. Run `launchctl load /Library/LaunchAgents/org.indyhall.networkmonitor.plist`
5. Cross your fingers. `launchd` is a mystery.