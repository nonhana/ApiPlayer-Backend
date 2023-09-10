#!/usr/bin/env node

/**
 * Module dependencies.
 */
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import app from '../app';
import debug from 'debug';

// 读取环境变量信息
dotenv.config();

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Define HTTPS/HTTP server creator.
 */
function createServer() {
	if (process.env.NODE_ENV === 'production') {
		const options = {
			key: fs.readFileSync(path.join(__dirname, '../public/ssl/nonhana.site.key')),
			cert: fs.readFileSync(path.join(__dirname, '../public/ssl/nonhana.site_bundle.pem')),
		};
		return https.createServer(options, app);
	} else {
		return http.createServer(app);
	}
}
const server = createServer();

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val: any) {
	const port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

/**
 * Event listener for HTTPS/HTTP server "error" event.
 */
function onError(error: any) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
		default:
			throw error;
	}
}

/**
 * Event listener for HTTPS/HTTP server "listening" event.
 */
function onListening() {
	const addr = server.address();
	const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr!.port;
	debug('Listening on ' + bind);

	console.log(`Server is running on port ${port}`);
}
