import dotenv from 'dotenv';
dotenv.config();

const { DB_HOST, DB_NAME, DB_USER, DB_PWD } = process.env;

export const dbConfig = {
	host: DB_HOST,
	user: DB_USER,
	password: DB_PWD,
	database: DB_NAME,
};
