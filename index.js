'use strict';

require('dotenv').config();

const dns = require('dns');
const ora = require('ora');
const speedtestnet = require('speedtest-net');
const tcpp = require('tcp-ping');
const Traceroute = require('traceroute-lite');
const Cachet = require('cachet-api');
const objectPath = require('object-path');
const Latenz = require('latenz');
const networkUnifi = require('network-unifi');

const argv = require('minimist')(process.argv.slice(2));
const DEBUG = (argv.debug && true === argv.debug);
if (DEBUG) {
	console.log('Running in debug mode.');
}

const config = require('./config.json');
const spinner = ora('Loading').start();

function unifiClients() {
	const options = {
		username: process.env.UNIFI_USER,
		password: process.env.UNIFI_PASS,
		port: 8443,
		url: process.env.UNIFI_HOST,
		site: 'default',
		ignoreSsl: true
	};
	
	return networkUnifi(options)
		.then(router => router.getClients())
		.then(clients => clients.length);
}

function latency() {
	const l = new Latenz();
	spinner.text = 'Measuring latency...';
	return l.measure(config.latency.domain).then(data => {

		const total = data.reduce((sum, row) => sum + row.time, 0);
		data.push({
			key: 'total',
			time: total
		});

		spinner.text = 'Done measuring latency.';
		return data;
	});
}

function speedtest() {
	return new Promise((resolve, reject) => {
		spinner.text = 'Starting speed test.';
		const test = speedtestnet({
			maxTime: (DEBUG ? 1000 : 30000)
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

			if (!hop.ip) {
				count++;
				return hop;
			}

			dns.reverse(hop.ip, (err, hostnames) => {
				count++;

				if (!err && hostnames && hostnames.length) {
					results[idx].hostname = hostnames[0];
					spinner.text = `Resolved ${hop.ip} to ${hostnames[0]}`;
				}
			});

			return hop;
		});

		const waiting = setInterval(() => {
			if (count >= hops.length) {
				clearInterval(waiting);
				spinner.text = 'Done resolving hostnames.';
				resolve(results);
			}
		}, 100);


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
		var report = [];

		function metric(path, value) {
			const id = objectPath.get(config, path);
			if (!id) {
				return;
			}

			if (DEBUG) {
				report.push(`[debug] Would set metric #${id} (${path}) to ${value}`);
				return;
			}

			if (!value) {
				const prettyValue = JSON.stringify(value);
				report.push(`Skipping metric #${id} (${path}) because value is ${prettyValue}`);
				return;
			}

			operations++;
			api.publishMetricPoint({id, value}).then(() => {
				report.push(`Set metric #${id} (${path}) to ${value}`);
				operations--;
			});
		}

		metric('speed.up_id', health.uploadSpeed);
		metric('speed.down_id', health.downloadSpeed);
		metric('trace.hops_id', health.traceroute.length);
		metric('trace.dropped_id', health.tracerouteDropped);
		metric('unifi.client_count_id', health.clientCount);

		config.pings.forEach((row, idx) => {
			const domain = row.domain;
			if (health.pings[domain]) {
				metric(`pings.${idx}.cachet_id`, health.pings[domain]);
			}
		});

		Object.keys(config.latency).forEach(id => {
			if (!/_id$/.test(id)) {
				return;
			}

			const key = id.replace(/_id$/, '');
			metric(`latency.${id}`, health.latency[key]);
		});

		const waiting = setInterval(() => {
			if (!operations) {
				clearInterval(waiting);
				spinner.text = 'Done sending to Cachet.';
				resolve(report);
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
	.then(() => latency())
	.then(data => {
		const latencyMap = {};
		data.forEach(row => latencyMap[row.key] = row.time);
		health.latency = latencyMap;
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
		health.tracerouteDropped = data.reduce((sum, row) => sum + (row.ip ? 0 : 1), 0);
	})
	.then(() => unifiClients())
	.then(clientCount => health.clientCount = clientCount)
	.then(() => cachet(health))
	.then(cachetReport => {
		spinner.stop();
		console.log('--- Results ---');
		console.log(JSON.stringify(health, null, 4));
		console.log('--- Cachet Report ---');
		cachetReport.forEach(line => console.log(line));
		process.exit(0);
	})
	.catch(err => console.error(err));