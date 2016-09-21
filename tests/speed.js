'use strict';

const speedtestnet = require('speedtest-net');
const Observable = require('rxjs/Rx').Observable;

module.exports = function(results, options) {
	const {limit} = options;
	
	return new Observable(observer => {
		observer.next(`Running speed test for ${limit} seconds`);

		const test = speedtestnet({
			maxTime: limit
		});
		
		test.on('testserver', server => observer.next(`Using server "${server.name}"`));
		test.on('downloadprogress', progress => observer.next(`Download progress: ${progress}%`));
		test.on('uploadprogress', progress => observer.next(`Upload progress: ${progress}%`));

		test.on('error', err => observer.error(err));
		test.on('data', data => {
			observer.next(`Speed test complete (${data.speeds.download} down/${data.speeds.upload} up)`);
			results.speedtest = data;
			observer.complete();
		});
	})
};