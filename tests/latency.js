'use strict';

const dns = require('dns');
const http = require('http');
const Observable = require('rxjs/Rx').Observable;

function hr2ms(tuple) {
	return (tuple[0] * 1000) + Math.round(tuple[1] / 1000000);
}

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
					
					var total = hr2ms(times.response);
					
					observer.next(`Measured ${total}ms latency to ${domain}.`);
					
					results.latency = {
						dns: hr2ms(times.dns),
						connect: hr2ms(times.connect),
						response: hr2ms(times.response)
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