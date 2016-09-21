'use strict';

const fs = require('fs');
const path = require('path');
const Listr = require('listr');
const dns = require('dns');

const latency = require('./tests/latency');
const ping = require('./tests/ping');
const trace = require('./tests/trace');
const speed = require('./tests/speed');
const unifi = require('./tests/unifi');

const cachet = require('./targets/cachet');

const argv = require('minimist')(process.argv.slice(2));
const DEBUG = (argv.debug && true === argv.debug);
const VERBOSE = (argv.verbose && true === argv.verbose);

var config, results = {}, logMessage;

console.log('\nRunning network health monitor' + (DEBUG ? ' (in debug mode)' : ''));
console.log(new Array(81).join('-'));

const latencyTask = {
	title: 'Latency',
	task: () => latency(results, {
		domain: config.tests.latency.domain
	}),
	skip: () => {
		if (!config.tests.latency) {
			return 'No latency test configuration';
		}
	}
};

const pingTask = {
	title: 'Ping',
	task: () => ping(results, {
		domains: config.tests.ping.map(row => row.domain)
	}),
	skip: () => {
		if (!config.tests.ping) {
			return 'No ping configuration';
		}
	}
};

const tracerouteTask = {
	title: 'Traceroute',
	task: () => trace(results, {
		domain: config.tests.trace.domain,
		timeout: config.tests.trace.timeout ? config.tests.trace.timeout * 1000 : 60000
	}),
	skip: () => {
		if (!config.tests.trace) {
			return 'No traceroute configuration';
		}
	}
};

const speedTask = {
	title: 'Speed',
	task: () => speed(results, {
		limit: DEBUG ? 1000 : (config.tests.speed.time_limit ? config.tests.speed.time_limit * 1000 : 30000)
	}),
	skip: () => {
		if (!config.tests.speed) {
			return 'No speed test configuration';
		}
	}
};

const unifiTask = {
	title: 'Unifi',
	task: () => speed(results, config.services.unifi),
	skip: () => {
		if (!config.services.unifi) {
			return 'No Unifi configuration';
		}
	}
};

const configTask = {
	title: 'Load Configuration',
	task: () => {
		try {
			config = require('./config.json');
			return true;
		} catch (e) {
			throw 'Unable to load ' + path.resolve('./config.json');
		}
	}
};

const testTask = {
	title: 'Run Network Tests',
	task: () => new Listr([
		unifiTask,
		latencyTask,
		pingTask,
		tracerouteTask,
		speedTask
	], {
		concurrent: true,
		renderer: (VERBOSE ? 'verbose' : 'default')
	})
};

const uploadTask = {
	title: 'Upload Results',
	task: () => cachet(results, config, DEBUG),
	skip: () => (DEBUG && !VERBOSE) ? 'Results from debug mode are not uploaded.' : null
};

const logTask = {
	title: 'Save Log File',
	task: () => new Promise((resolve, reject) => {
		const {filename, mode} = config.logging;
		const logfile = path.resolve(__dirname, filename);
		const opts = {
			encoding: 'utf8',
			flag: ('a' === mode ? 'a' : 'w')
		};
		fs.writeFile(logfile, JSON.stringify(results, null, 2), opts, err => {
			if (err) {
				reject(err);
			}

			logMessage = '\nResults ' + ('a' === opts.flag ? 'appended' : 'written') + ' to ' + logfile;
			resolve();
		});
	}),
	skip: () => (!config.logging || !config.logging.filename) ? 'No log file configured' : null
};

const tasks = new Listr([
	configTask,
	testTask,
	uploadTask,
	logTask
], {
	renderer: (VERBOSE ? 'verbose' : 'default')
});

const onError = (e) => {
	console.log(`\nThere was an error: ${e}\n`);
	if (DEBUG) {
		console.error(e);
	}
	process.exit(1);
};

const onDone = () => {
	if (VERBOSE) {
		console.log('\nResults: ' + JSON.stringify(results, null, 2));
	}

	if (logMessage) {
		console.log(logMessage);
	}

	console.log('');
	process.exit(0);
};

// Run and handle results
tasks.run()
	.then(onDone)
	.catch(onError);