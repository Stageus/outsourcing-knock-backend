const {Client} = require('pg');
const dotenv = require('dotenv');
const { BadRequestError, UnauthorizedError, PostgreConnectionError, SqlSyntaxError} = require("../errors/error.js");
const path = require('path');
dotenv.config({path : path.join(__dirname, "../config/.env")});
const config = {
    user: process.env.POSTGRESQL_USER,
    host : process.env.POSTGRESQL_HOST,
    database : process.env.POSTGRESQL_DBNAME,
    password : process.env.POSTGRESQL_PASSWORD,
    port : process.env.POSTGRESQL_PORT,
};

module.exports =  class Postgres {
    Postgres(){
        this.connectionPool = null;
    }
    async connect(){
        try{
            this.connectionPool = new Client(config);
            await this.connectionPool.connect();
            // await this.connectionPool.end();
            return;
        }
        catch(err){
            throw new PostgreConnectionError(err);
        }
    }

    async queryExcute(sql, parameter){
        try{
            const result = await this.connectionPool.query(sql,parameter);
            return result;
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }

    }

    async queryUpdate(sql, parameter){
        try{
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }
    }
}
        