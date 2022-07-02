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
    };
    
    const pg = new postgres();
    await pg.connect();
    const pgResult = await pg.queryExcute(`select * from knock.users`, []);
    console.log(pgResult.rows);

    // log
    const mongo = new mongodb();
    await mongo.connect();
    const mongoResult = await mongo.createLog(reqId, "login", JSON.stringify(req.body), JSON.stringify(result));

    console.log(mongoResult);

    res.send(result);
};

module.exports.createAccount = async(req, res)=>{
    // TODO : Need composing this api.
}