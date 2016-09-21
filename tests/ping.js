'use strict';

const tcpp = require('tcp-ping');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, options) {
	const {domains} = options;
	
	return new Observable(observer => {
		const pings = [];
		observer.next(`Pinging ${domains.length} domain(s)...`);

		for (let address of domains) {
			tcpp.ping({address}, (err, data) => {
				const row = {
					address,
					result: err ? null : data.avg
				};
				pings.push(row);
				observer.next(`${address} ping: ${row.result}`);
			});
		}

		const waiting = setInterval(() => {
			if (pings.length === domains.length) {
				clearInterval(waiting);
				observer.next('All pings complete.');
				const pingMap = {};
				pings.forEach(row => pingMap[row.address] = row.result);
				results.ping = pingMap;
				observer.complete();
			}
		}, 100);
	})
};