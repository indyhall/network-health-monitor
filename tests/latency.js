'use strict';

const dns = require('dns');
const http = require('http');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, options) {
	const {domain} = options;
	const times = {
		start: process.hrtime()
	};
	
	return new Observable(observer => {
		observer.next(`Measuring HTTP latency to ${domain}...`);
		
		dns.lookup(domain, (err, address) => {
			times.dns = process.hrtime(times.start);
			observer.next(`Resolved ${domain} to ${address}`);
			
			if (err) {
				return observer.error(err);
			}
			
			const opts = {
				host: address,
				port: 80,
				path: '/',
				method: 'GET',
				headers: {
					'Host': domain
				}
			};
			http.request(opts, res => {
				res.on('end', () => {
					times.response = process.hrtime(times.start);
					
					var total = (times.response[0] * 1000) + Math.round(times.response[1] / 1000000);
					
					observer.next(`Measured ${total}ms latency to ${domain}.`);
					
					results.latency = {
						dns: (times.dns[0] * 1000) + Math.round(times.dns[1] / 1000000),
						connect: (times.connect[0] * 1000) + Math.round(times.connect[1] / 1000000),
						response: (times.response[0] * 1000) + Math.round(times.response[1] / 1000000)
					};
					observer.complete();
				});
				res.resume();
			}).on('socket', socket => {
				socket.on('connect', () => {
					times.connect = process.hrtime(times.start);
					observer.next('Connected to host');
				});
			}).on('error', e => {
				observer.error(e);
			}).end();
		});
	})
};