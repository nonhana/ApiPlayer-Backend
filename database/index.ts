import mysql from 'mysql2';
import { dbConfig } from './db.config';

const db = mysql.createPool({
	...dbConfig,
	connectionLimit: 10,
});

// 判断连接是否成功并打印连接信息
db.getConnection((err, _) => {
	if (err) {
		console.log('数据库连接失败');
	} else {
		console.log('数据库连接成功');
	}
});

export default db;
