const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const {PostgreConnectionError, SqlSyntaxError, NullExceptionError} = require('../errors/error');
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
    const email = req.body.email;
    const password = req.body.password;
    const nickname = req.body.nickname;
    const pg = new postgres();

    try{
        nullCheck(email, password, nickname);
    
        await pg.connect();
        await pg.queryExecute(
        `
        IF NOT EXISTS (SELECT * FROM knock.users WHERE email = $1) THEN
        INSERT INTO knock.users (id,password, nickname,platform) VALUES($1, $2, $3);
        `
        [email, password, nickname]);

        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullExceptionError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    finally{
        pg.disconnect();
    }
}
