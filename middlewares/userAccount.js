const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, TokenIssueError} = require('../errors/error');
const parameter = require('../utils/parameter');
const postgres = require("../database/pg");
const mongodb = require("../database/MongoDB");
const crypto = require('crypto');
const salt = crypto.randomBytes(128).toString('base64');

module.exports.login = async(req, res)=>{
    
    const email = req.body.email;
    const password = req.body.password;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await crypto.createHash('sha512').update(password + salt).digest('hex');
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT user_index, user_status FROM knock.users WHERE id = $1 AND password = $2;
            `
        ,[email, hashedPassword]);

        
        if(result.rows.length == 0)       // id, password 쌍이 존재하지 않을 경우
            return res.status(401).send();
        else if(result.rows[0].user_status == "block")  // 차단된 사용자일 경우
            return res.status(403).send();
        
        const token = await jwtToken.issueToken(email); // 인증된 사용자라면 토큰을 만들어준다.
        
        return res.status(200).send({
            userId : result.rows[0].user_index,
            token : token
        })

    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
    
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof TokenIssueError)
            return res.status(500).send();
    }
    finally{

    }

};

module.exports.createAccount = async(req, res)=>{
    const email = req.body.email;
    const password = req.body.password;
    const nickname = req.body.nickname;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password, nickname);
        const hashedPassword = await crypto.createHash('sha512').update(password + salt).digest('hex');
        await pg.connect();
        await pg.queryUpdate(
        `
        INSERT INTO knock.users (id, password, nickname, platform) VALUES($1, $2, $3, 'knock');
        `,
        [email, hashedPassword, nickname]);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    finally{
        await pg.disconnect();
    }
}
