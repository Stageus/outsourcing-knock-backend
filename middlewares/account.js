const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const postgres = require("../database/pg");
const mongodb = require("../database/MongoDB");
const router = require('../routes/router');

module.exports.login = async(req, res)=>{
    const reqId = req.body.id;
    const reqPw = req.body.pw;
    const result = {
        "success" : false,
        "errmsg" : "empty",
        "token" : "",
    };
    
    const pg = new postgres();
    await pg.connect();
    const pgResult = await pg.queryExcute(`select * from knock.users`, []);
    console.log(pgResult);

    const token = await jwtToken.issueToken(reqId, reqPw);
    result.token = token;

    // log
    const mongo = new mongodb();
    await mongo.connect();
    const mongoResult = await mongo.createLog(reqId, "login", JSON.stringify(req.body), JSON.stringify(result));

    console.log(mongoResult);

    res.status(200).send(result);
};

module.exports.tokenLogin = async(req, res) => {
    const result = {
        "success" : false,
        "errmsg" : "empty",
    };

    // check token is arrived
    if(req.headers.auth === undefined){
        result.errmsg = "token is not exist";
        res.status(400).send(result);
        return;
    }

    // verify token
    const verifyTokenResObj = jwtModule.verifyToken(req, res);
    if(verifyTokenResObj.status != 'valid'){
        if(verifyTokenResObj.status == 'expired') result.errmsg = "Token is expired";
        else if(verifyTokenResObj.status == 'invalid') result.errmsg = "Token is invalid";
        else result.errmsg = "Unknown Error in token verify";
        res.status(401).send(result);
        return;
    }

    result.success = true;
    res.status(200).send(result);
}