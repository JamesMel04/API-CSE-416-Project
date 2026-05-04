import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
/** Singleton pool to import in all places */
let playersPool :any;
if(process.env.DB_LINK) {
  playersPool=new Pool({
    connectionString: process.env.DB_LINK,
    ssl:{rejectUnauthorized: false}
  });
}
// Else it'll use your local instance
// If you want to test locally via downloading and running your own Postgres instance,
// Just delete the env variable and run on port 5432
else {
  playersPool=new Pool({
    host: 'localhost',
    port: 5432,
    database: 'mlbtest',
    user: 'postgres',
    password: process.env.DB_PASSWORD, //Whatever you set as your local password
  });
}

export default playersPool;