const {Client} = require('pg');
const dotenv = require('dotenv');
const error = require("../errors/error.js");
dotenv.config({path : path.join(__dirname, "../config/.env")});
const config = {
    user: process.env.POSTGRESQL_USER,
    host : process.env.POSTGRESQL_HOST,
    database : process.env.POSTGRESQL_NAME,
    password : process.env.POSTGRESQL_PASSWORD,
    port : process.env.POSTGRESQL_PORT,
};

class Postgres {
    connectionPool;
    connect  = async()=>{
        try{
            this.connectionPool = new Client(config);
            await connectionPool.connect();
            return;
        }
        catch(err){
            throw new PostgreConnectionError(err);
        }
    }

    queryExcute = async(sql, parameter) =>{
        try{
            const result = await connectionPool.query(sql,parameter);
            return result;
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }

    }

    queryUpdate = async(sql, parameter)=>{
        try{
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }
    }
}
        