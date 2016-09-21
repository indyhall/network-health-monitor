'use strict';

const Traceroute = require('traceroute-lite');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, options) {
	const {domain, timeout} = options;
	
	return new Observable(observer => {
		observer.next(`Running traceroute to ${domain}`);

		const partial = [];
		const trace = new Traceroute(domain);

		const timer = setTimeout(() => {
			observer.next('Traceroute timed out.');
			results.traceroute = partial;
			observer.complete();
		}, timeout);

		trace.on('hop', hop => {
			partial.push(hop);
			if (!hop.ip || !hop.ms) {
				return observer.next(`Packet dropped (hop ${hop.counter})`);
			}
			observer.next(`[${hop.counter}] ${hop.ip} - ${hop.ms}ms`);
		});

		trace.start((err, hops) => {
			clearTimeout(timer);
			observer.next('Traceroute complete.');

			if (err) {
				results.traceroute = partial;
				return observer.error(err);
			}

			results.traceroute = hops;
			return observer.complete();
		});

		// return () => null; // FIXME
		// return () => clearTimeout(timer) && clearInterval(timer2);
	})
};