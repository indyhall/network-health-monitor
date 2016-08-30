'use strict';

require('dotenv').config();

const dns = require('dns');
const ora = require('ora');
const speedtestnet = require('speedtest-net');
const tcpp = require('tcp-ping');
const Traceroute = require('traceroute-lite');
const Cachet = require('cachet-api');
const objectPath = require('object-path');

const config = require('./config.json');
const spinner = ora('Loading').start();

function speedtest() {
	return new Promise((resolve, reject) => {
		spinner.text = 'Starting speed test.';
		const test = speedtestnet({
			maxTime: 1000 // FIXME
		});

		test.on('testserver', server => spinner.text = `Using server "${server.name}"`);
		test.on('downloadprogress', progress => spinner.text = `Download progress: ${progress}%`);
		test.on('uploadprogress', progress => spinner.text = `Download progress: ${progress}%`);

		test.on('error', err => reject(err));
		test.on('data', data => {
			spinner.text = 'Speed test complete.';
			return resolve(data);
		});
	});
}

function ping() {
	return new Promise(resolve => {
		spinner.text = 'Starting ping tests.';

		const pingDomains = config.pings.map(row => row.domain);
		const results = [];

		for (let address of pingDomains) {
			tcpp.ping({address}, (err, data) => {
				const row = {
					address,
					result: err ? null : data.avg
				};
				results.push(row);
				spinner.text = `${address} ping: ${row.result}`;
			});
		}
		
		const waiting = setInterval(() => {
			if (results.length === pingDomains.length) {
				clearInterval(waiting);
				spinner.text = 'All ping tests complete.';
				resolve(results);
			}
		}, 100);
	});
}

function trace() {
	return new Promise((resolve, reject) => {
		spinner.text = 'Starting traceroute...';

		const partial = [];
		const trace = new Traceroute(config.trace.domain);

		const timeout = setTimeout(() => {
			spinner.text = 'Traceroute timed out.';
			resolve(partial);
		}, 60000);

		trace.on('hop', hop => {
			partial.push(hop);

			if (!hop.ip || !hop.ms) {
				spinner.text = `Traceroute progress: packet dropped (hop ${hop.counter})`;
				return;
			}

			spinner.text = `Traceroute progress: ${hop.ip} ${hop.ms}ms (hop ${hop.counter})`;
		});

		trace.on('done', (err, hops) => {
			clearTimeout(timeout);
			spinner.text = 'Traceroute complete.';

			if (err) {
				return reject(err);
			}

			return resolve(hops);
		});

		trace.start();
	});
}

function reverseTrace(hops) {
	return new Promise(resolve => {
		spinner.text = 'Resolving hostnames...';

		var count = 0;
		const results = hops.map((hop, idx) => {
			hop.hostname = hop.ip;

			dns.reverse(hop.ip, (err, hostnames) => {
				count++;

				if (!err && hostnames && hostnames.length) {
					results[idx].hostname = hostnames[0];
					spinner.text = `Resolved ${hop.ip} to ${hostnames[0]}`;
				}

				if (count >= hops.length) {
					resolve(results);
				}
			});

			return hop;
		});
	});
}

function cachet(health) {
	// Optionally push metrics to Cachet
	if (!process.env.CACHET_KEY || !process.env.CACHET_URL) {
		return Promise.resolve(health);
	}

	return new Promise(resolve => {
		spinner.text = 'Sending data to Cachet server...';

		const {CACHET_KEY, CACHET_URL} = process.env;
		const api = new Cachet({
			url: CACHET_URL,
			apiKey: CACHET_KEY
		});

		var operations = 0;

		function metric(path, value) {
			const id = objectPath.get(config, path);
			if (!id) {
				return;
			}

			operations++;
			api.publishMetricPoint({id, value}).then(() => operations--);
		}

		metric('speed.up_id', health.uploadSpeed);
		metric('speed.down_id', health.downloadSpeed);
		metric('trace.cachet_id', health.traceroute.length);

		config.pings.forEach((row, idx) => {
			const domain = row.domain;
			if (health.pings[domain]) {
				metric(`pings.${idx}.cachet_id`, health.pings[domain]);
			}
		});

		const waiting = setInterval(() => {
			if (!operations) {
				clearInterval(waiting);
				spinner.text = 'Done sending to Cachet.';
				resolve();
			}
		}, 100);
	});
}

const health = {};

speedtest()
	.then(data => {
		health.ip = data.client.ip;
		health.downloadSpeed = data.speeds.download;
		health.uploadSpeed = data.speeds.upload;
	})
	.then(() => ping())
	.then(data => {
		const pingMap = {};
		data.forEach(row => pingMap[row.address] = row.result);
		health.pings = pingMap;
	})
	.then(() => trace())
	.then(data => reverseTrace(data))
	.then(data => {
		health.traceroute = data;
	})
	.then(() => cachet(health))
	.then(() => {
		spinner.stop();
		console.log('--- Results ---');
		console.log(JSON.stringify(health, null, 4));
		process.exit(0);
	})
	.catch(err => console.error(err));