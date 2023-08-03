import mysql from "mysql";

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "20021209xiang",
  database: "littleSharing~",
});

export default db;
