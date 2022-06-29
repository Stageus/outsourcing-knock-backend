const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const postgres = require("../database/pg");
const mongodb = require("../database/MongoDB");

module.exports.login = async(req, res)=>{
    const reqId = req.body.id;
    const reqPw = req.body.pw;
    const result = {
        "success" : false,
        "errmsg" : "empty",
        "session_id" : "empty",
    };
    
    // const pg = new postgres();
    // pg.connect();
    // const result = await pg.queryExcute(`select * from knock.users`, []);
    // console.log(result);

    // log
    const mongo = new mongodb();
    await mongo.connect();
    await mongo.setSchema();
    const mongoResult = await mongo.createLog(reqId, "login", JSON.stringify(req.body), JSON.stringify(result));

    console.log(mongoResult);

    res.send(result);
};