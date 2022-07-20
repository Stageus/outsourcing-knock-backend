const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError, TokenIssueError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');


module.exports.login = async(req,res) =>{
        
    const email = req.body.email;
    const password = req.body.password;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT admin_index FROM knock.super_admin WHERE email = $1 AND password = $2;
            `
        ,[email, hashedPassword]);
        if(result.rowCount == 0)       // id, password 쌍이 존재하지 않을 경우
            return res.status(401).send();
        
        const token = await jwtToken.issueAdminToken(result.rows[0].admin_index);

        return res.status(200).send({
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

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }

}


module.exports.searchUser = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const pageCount = (req.params.pageCount-1) * 10;
    const pg = new postgres();
    let category = null;

    if(searchCategory == "이메일")
        category = "id";
    else if(searchCategory == "닉네임")
        category = "nickname";
    
    try{
        await parameter.nullCheck(searchWord, category, startDate, endDate, pageCount);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, id AS email, nickname, created_at, is_blocked, is_left
            FROM knock.users
            WHERE ${category} LIKE $1 
            AND created_at BETWEEN $2 AND $3
            LIMIT 10 OFFSET $4;
            `
        ,[searchWord, startDate, endDate, pageCount]);
        console.log(searchWord);
        return res.status(200).send({
            totalPageCount : Math.floor((result.rowCount/10))+1,
            userList : result.rows
        })
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.modifyUserBlockingStatus =async(req,res) =>{
    const isBlocked = req.body.isBlocked;
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(isBlocked, userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users
            SET is_blocked = $1
            WHERE user_index = $2;
            `
            ,[isBlocked, userId]);

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

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.checkDuplicatedEmail =async(req,res) =>{
    const email = req.params.email;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id FROM knock.users 
            WHERE id = $1;
            `
            ,[email]);
        
        if(result.rowCount == 0)
            return res.status(404).send();
        else
            return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

/*
module.exports.checkDuplicatedEmail =async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id FROM knock.users 
            WHERE id = $1;
            `
            ,[email]);
        
        if(result.rowCount == 0)
            return res.status(404).send();
        else
            return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}
*/