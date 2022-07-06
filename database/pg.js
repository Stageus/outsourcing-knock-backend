const {Client} = require('pg');
const dotenv = require('dotenv');
const {PostgreConnectionError, SqlSyntaxError} = require("../errors/error.js");
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
    Postgres(){                     // postgres 객체를 생성합니다.
        this.connectionPool = null;
    }
    async connect(){                // postgresql 데이터베이스와 연결합니다.
        try{
            this.connectionPool = new Client(config);
            await this.connectionPool.connect();
            return;
        }
        catch(err){
            throw new PostgreConnectionError(err);
        }
    }

    async queryExecute(sql, parameter){ // 파라미터로 받은 쿼리를 실행하고 결과값을 return합니다.
        try{
            const result = await this.connectionPool.query(sql,parameter);
            return result;
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }

    }

    async queryUpdate(sql, parameter){  // 파라미터로 받은 쿼리를 실행합니다.
        try{
            await this.connectionPool.query(sql,parameter);
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }
    }

    async disconnect(){                 // 데이터베이스와의 연결을 끊습니다.
        await this.connectionPool.end();
    }
}
        
