const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { MongoConnectionError, MongoCreateError, MongoDeleteError} = require("../errors/error.js");
const path = require('path');
dotenv.config({path : path.join(__dirname, "../config/.env")});

const config = {
    user: process.env.MONGO_USER,
    password : process.env.MONGO_PASSWORD,
    host : process.env.MONGO_HOST,
    port : process.env.MONGO_PORT,
    database : process.env.MONGO_DBNAME,
    collection : process.env.MONGO_COLLECTIONNAME,
};

module.exports = class Mongo {
    Mongo(){
        this.connectionPool = null; 
        this.logSchema = null;
        this.logModel = null;
    }

    async connect(){
        try{
            this.connectionPool = await mongoose.createConnection(
                `mongodb://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`);

            await this.setSchema();

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

            this.logModel = await this.connectionPool.model("log", this.logSchema, config.collection);

            return;
        }
        catch(err){
            console.log(err);
        }
    }

    async disconnect(){
        this.connectionPool.disconnect();
    }

    async createLog(api, header, req, res, msg){
        const LogContent = { 
            "log_time": new Date(),
            "api_type": api, // req.Url
            "header_data" : header,
            "req_data": req,
            "res_data": res,
            "err_msg" : msg,
        };
    
        try{
            const result = await this.logModel.create(LogContent);
            return result;
        }
        catch(err){
            throw new MongoCreateError(err);
        }
    }

    async deleteAllLog(){
        try{
            await this.logModel.deleteMany();
        }
        catch(err){
            throw new MongoDeleteError(err);
        }
    }
}
