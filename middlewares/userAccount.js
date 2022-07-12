const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, TokenIssueError, SendMailError} = require('../errors/error');
const parameter = require('../utils/parameter');
const postgres = require("../database/pg");
const mongodb = require("../database/MongoDB");
const mailer = require('../utils/email');
const hasing = require('../utils/password');

module.exports.login = async(req, res)=>{
    
    const email = req.body.email;
    const password = req.body.password;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, user_status FROM knock.users WHERE id = $1 AND password = $2;
            `
        ,[email, hashedPassword]);
        if(result.rowCount == 0)       // id, password 쌍이 존재하지 않을 경우
            return res.status(401).send();
        else if(result.rows[0].user_status == "block")  // 차단된 사용자일 경우
            return res.status(403).send();
        
        const token = await jwtToken.issueToken(result.rows[0].user_id); // 인증된 사용자라면 유저 index값을 넣어 토큰을 만들어준다.
        
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
        const hashedPassword = await hasing.createHashedPassword(password);
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

module.exports.resetPassword = async(req,res) =>{
    const email = req.body.email;
    const pg = new postgres();

    try{
        await parameter.nullCheck(email);
        const tmpPassword = Math.random().toString(36).substring(2,11);
        const hashedPassword =  await hasing.createHashedPassword(tmpPassword);
        console.log(tmpPassword);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET password = $1 WHERE id = $2;
            `
        ,[hashedPassword, email])
        
        await mailer.sendMail(tmpPassword, email);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
    
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(409).send();

        if(err instanceof SendMailError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}


module.exports.getAlarmList = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
        `
        SELECT alarm_index AS alarm_id, title, content, created_at, is_checked FROM knock.alarm WHERE user_index = $1;
        `,
        [userId]);
        
        await pg.queryUpdate(   // 확인한 알람들의 is_checked를 true로 set합니다.
            `
            UPDATE knock.alarm SET is_checked = true 
            WHERE user_index IN (
                SELECT user_index
                FROM knock.alarm
                WHERE user_index = $1 AND is_checked = false AND alarm_index <= $2
            );
            `
        ,[userId, result.rows[0].alarm_id]);
        return res.status(200).send({
            alarmList : result.rows
        });
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }   
}

module.exports.addFavoriteExpert = async(req, res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    const expertId = req.body.expertId;
    
    try{
        await parameter.nullCheck(userId, expertId);
        await pg.connect();
        await pg.queryExecute(
            `
            INSERT INTO knock.favorite_expert (user_index, expert_index)
            VALUES($1, $2);
            `
        ,[userId, expertId]);
        
        return res.status(200).send();
    }
    catch(err){

        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        }
    finally{
        pg.disconnect();
    }
}

module.exports.deleteFavoriteExpert = async(req, res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    const expertId = req.body.expertId;
    
    try{
        await parameter.nullCheck(userId, expertId);
        await pg.connect();
        await pg.queryExecute(
            `
            DELETE FROM knock.favorite_expert WHERE user_index = $1 AND expert_index = $2;
            `
        ,[userId, expertId]);
        
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        }
    finally{
        pg.disconnect();
    }
}

module.exports.getUserInformation = async(req,res) =>{
    const pg = new postgres();
    const userId = req.params.userid;

    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id AS email, nickname, email_certification AS is_email_certified FROM knock.users WHERE user_index = $1;
            `
        ,[userId]);

        return res.status(200).send(result.rows[0]);
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.sendAuthenticationEmail = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id AS email FROM knock.users WHERE user_index = $1;
            `
        ,[userId])
        await mailer.sendAuthenticationMail(userId, result.rows[0].email);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof SendMailError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.authenticateUserEmail = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET email_certification = true WHERE user_index = $1;
            `
        ,[userId])
        return res.status(200).send("<script>window.close();</script >");
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.modifyUserInformation = async(req, res) =>{
    const userId = req.params.userid;
    const password = req.body.password;
    const nickname = req.body.nickname;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId, password, nickname);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET password = $1, nickname =$2 WHERE user_index = $3;
            `
        ,[hashedPassword, nickname, userId]);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}


module.exports.deleteUserInformation = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET user_status = 'withdrawal' WHERE user_index = $1;
            `
        ,[userId])
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}


module.exports.kakaoLogin = async(req, res) =>{
    const pg = new postgres();
    try{
        pg.connect();
        pg.queryExecute(
            `
            INSERT INTO knock.users (user_id, nickname, platform) 
            VALUES($1, $2, 'kakao');
            `
        ,[])


        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}