'use strict';

const Cachet = require('cachet-api');
const objectPath = require('object-path');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, config, DEBUG) {
	return new Observable(observer => {
		observer.next('Sending data to Cachet server...');
		
		const api = new Cachet(config.services.cachet);

		var operations = 0;
		var report = [];

		function metric(path, value) {
			const id = objectPath.get(config.tests, path);
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

		if (results.speedtest) {
			metric('speed.up_id', results.speedtest.speeds.upload);
			metric('speed.down_id', results.speedtest.speeds.download);
		}

		if (results.traceroute) {
			metric('trace.hops_id', results.traceroute.length);
			metric('trace.dropped_id', results.traceroute.reduce((sum, row) => sum + (row.ip ? 0 : 1), 0));
		}

		if (results.unifi) {
			metric('unifi.client_count_id', results.unifi.clients);
		}

		if (results.ping) {
			config.tests.ping.forEach((row, idx) => {
				const domain = row.domain;
				if (results.ping[domain]) {
					metric(`ping.${idx}.cachet_id`, results.ping[domain]);
				}
			});
		}

		if (results.latency) {
			Object.keys(config.tests.latency).forEach(id => {
				if (!/_id$/.test(id)) {
					return;
				}

				const key = id.replace(/_id$/, '');
				metric(`latency.${id}`, results.latency[key]);
			});
		}

		const waiting = setInterval(() => {
			if (!operations) {
				clearInterval(waiting);
				report.map(line => observer.next(line));
				observer.complete();
			}
		}, 100);
	});
}