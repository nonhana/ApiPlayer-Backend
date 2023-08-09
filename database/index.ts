import mysql from 'mysql';

const db = mysql.createPool({
	host: '13.115.119.139',
	user: 'root',
	password: 'ec2demoserverdatabase',
	database: 'apiplayer',
});

export default db;
