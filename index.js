'use strict';

const dns = require('dns');
const ora = require('ora');
const speedtestnet = require('speedtest-net');
const tcpp = require('tcp-ping');
const Traceroute = require('traceroute-lite');

const traceDomain = 'google.com';
const pingSites = [
	'google.com',
	'facebook.com',
	'baidu.com',
	'yahoo.com',
	'amazon.com',
	'wikipedia.org',
	'yandex.ru',
	'fc2.com',
	'diply.com'
];

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

		const results = [];
		for (let address of pingSites) {
			tcpp.ping({address}, (err, data) => {
				const row = {
					address,
					result: err ? 'Error' : `${data.avg}ms`
				};
				results.push(row);
				spinner.text = `${address} ping: ${row.result}`;
			});
		}
		
		const waiting = setInterval(() => {
			if (results.length === pingSites.length) {
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
		const trace = new Traceroute(traceDomain);

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

const health = {};

speedtest()
	.then(data => {
		health.ip = data.client.ip;
		health.downloadSpeed = data.speeds.download;
		health.uploadSpeed = data.speeds.upload;
	})
	.then(() => ping())
	.then(data => {
		health.pings = data;
	})
	.then(() => trace())
	.then(data => reverseTrace(data))
	.then(data => {
		health.traceroute = data;
	})
	.then(() => {
		spinner.stop();
		console.log(JSON.stringify(health, null, 4));
		process.exit(0);
	})
	.catch(err => console.error(err));


/*
 { speeds:
 { download: 79.827,
 upload: 59.137,
 originalDownload: 8791517,
 originalUpload: 6489988 },
 client:
 { ip: '68.83.136.192',
 lat: 39.953,
 lon: -75.1756,
 isp: 'XFINITY',
 isprating: 2.8,
 rating: 0,
 ispdlavg: 27.61,
 ispulavg: 5.952 },
 server:
 { host: 'web01.quonix.net',
 lat: 39.95,
 lon: -75.1667,
 location: 'Philadelphia, PA',
 country: 'United States',
 cc: 'US',
 sponsor: 'Quonix, Inc.',
 distance: 0.83,
 distanceMi: 0.51,
 ping: 16.3,
 id: '7519' } }
 */