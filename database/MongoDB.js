const mongoose = requrie('mongoose');
const dotenv = require('dotenv');
const { BadRequestError, UnauthorizedError, MongoConnectionError, SqlSyntaxError} = require("../errors/error.js");
const path = require('path');
dotenv.config({path : path.join(__dirname, "../config/.env")});

const config = {
    user: process.env.MONGODB_USER,
    password : process.env.MONGODB_PASSWORD,
    host : process.env.MONGODB_HOST,
    port : process.env.MONGODB_PG_PORT,
    database : process.env.MONGODB_DBNAME,
};

module.exports = class Mongo {
    Mongo(){
        this.connectionPool = null; 
        this.logSchema = null;
        this.logModel = null;
    }

    async connect(){
        try{
            this.connectionPool = mongoose.createConnection('mongodb://'
            + config.user +':'
            + config.password +'@'
            + config.host + ':' + config.port
            + '/' +  "log");

            return;
        }
        catch(err){
            throw new MongoConnectionError(err);
        }
    }

    async setSchema(){
        try{
            this.logSchema = new mongoose.Schema({
                log_time: Date,
                user_id: String,
                api_type: String,
                req_data: String,
                res_data: String,
            });

            this.logModel = this.connectionPool.model("log", this.logSchema);

            return;
        }
        catch(err){

        }
    }

    queryExcute = async(sql, parameter) =>{
        try{
            // write according to mongo format
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }

    }

    queryUpdate = async(sql, parameter)=>{
        try{
            // write according to mongo format
        }
        catch(err){
            throw new SqlSyntaxError(err);
        }
    }
}

const connect = () => {
    return mongoose.createConnection('mongodb://'
    + config.user +':'
    + config.password +'@'
    + config.host + ':' + config.port
    + '/' +  "log"
    , function (err) {
        if (err) {
            console.error('mongodb connection error', err);
        }
        console.log('mongodb logDB connected');
    });
}

const logConn = connect();

const LogModel =  logConn.model("log", logSchema);

module.exports = LogModel;