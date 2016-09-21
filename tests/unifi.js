'use strict';

const unifi = require('network-unifi');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, options) {
	const {host, username, password} = options;

	return new Observable(observer => {
		const options = {
			username,
			password,
			port: 8443,
			url: host,
			site: 'default',
			ignoreSsl: true
		};

		observer.next(`Connecting to Unifi controller at ${host}`);

		return unifi(options)
			.then(router => {
				observer.next('Loading client list');
				return router.getClients();
			})
			.then(clients => {
				observer.next(`${clients.length} clients detected`);
				results.unifi = {
					clients: clients.length
				};
				observer.complete();
			}).catch(e => observer.error(e));
	})
};