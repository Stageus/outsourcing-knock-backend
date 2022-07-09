const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');

//추천 전문가 리스트 가져오기 (3명)
module.exports.getRecommendedExpertsList = async(req,res) =>{
    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index AS expert_id, name, introduction_contents AS introduction, profile_img_url,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = expert.expert_index) AS review_count,
            (SELECT expert_type AS type FROM knock.have_expert_type INNER JOIN knock.expert_type ON have_expert_type.expert_type_index = expert_type.expert_type_index WHERE have_expert_type.expert_index = expert.expert_index)
            FROM knock.expert ORDER BY RANDOM() LIMIT 3;
            `
        ,[])

        return res.status(200).send({
            bannerList : result.rows
        })
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

// 전문가 로그인
module.exports.login = async(req,res)=>{
    const email = req.body.email;
    const password = req.body.password;
    const maintain = req.body.maintain;
    const pg = new postgres();

    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index, expert_status FROM knock.expert 
                WHERE email = $1 AND password = $2;
            `
        , [email, hashedPassword]);
        
        if(result.rowCount == 0){
            return res.status(401).send();
        }
        else if(result.rows[0].expert_status == "wait"){
            return res.status(403).send({
                msg : "가입 승인 처리 대기 중입니다.",
                rejectmsg : "",
            });
        }
        else if(result.rows[0].expert_status == "accepted"){
            return res.status(403).send({
                msg : "가입 승인 처리가 완료되었습니다.",
                rejectmsg : "",
            });
        }
        else if(result.rows[0].expert_status == "apply"){
            return res.status(403).send({
                msg : "전문가 신청 처리 대기 중입니다.",
                rejectmsg : "",
            });
        }
        else if(result.rows[0].expert_status == "reject"){
            return res.status(403).send({
                msg : "신청이 반려되었습니다.",
                rejectmsg : "(반환 사유)", // 반환 사유 table 생성 및 가져오기
            });
        }
        else if(result.rows[0].expert_status == "block"){
            return res.status(403).send({
                msg : "계정이 차단되었습니다.",
                rejectmsg : "",
            });
        }

        let token;
        if(maintain === true){
            token = await jwtToken.issueToken(result.rows[0].expert_index, "7 days");
        }
        else{
            token = await jwtToken.issueToken(result.rows[0].expert_index);
        }

        return res.status(200).send({
            expertId : result.rows[0].expert_index,
            token : token,
            msg : "Success Login",
            rejectmsg : ""
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
        if(err instanceof TokenIssueError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

// 전문가 회원가입
module.exports.createAccount = async(req,res)=>{
    // expert table
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const call = req.body.call;
    const profileImgUrl = req.body.profileImgUrl;
    const idCardImgUrl = req.body.idCardImgUrl;
    const bankBookImgUrl = req.body.bankBookImgUrl;
    const education = req.body.education;
    const qualification = req.body.qualification;
    const career = req.body.career;
    // expert_education_img table
    const educationImgUrl = req.body.educationImgUrl;
    // expert_career_img table
    const careerImgUrl = req.body.careerImgUrl;
    // expert_type table
    const expertType = req.body.expertType;

    const pg = new postgres();

    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);
        await pg.queryUpdate(
            `
            INSERT into knock.expert (name, email, password, phone_number, profile_img_url, id_card_img_url, bankbook_copy_img_url, education, qualification, career, created_at) 
	            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());
            `
        , [name, email, hashedPassword, call, profileImgUrl, idCardImgUrl, bankBookImgUrl, education, qualification, career]);
        
        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_education_img (expert_index, education_img_url)
                VALUES(
                    (SELECT expert_index FROM knock.expert WHERE email = $1), $2);
            `
        , [email, educationImgUrl]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_career_img (expert_index, career_img_url)
                VALUES(
                    (SELECT expert_index FROM knock.expert WHERE email = $1), $2);
            `
        , [email, careerImgUrl]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.have_expert_type (expert_index, expert_type_index)
                VALUES(
                    (SELECT expert_index FROM knock.expert WHERE email = $1), 
                    (SELECT expert_type_index FROM knock.expert_type WHERE expert_type = $2)
                );
            `
        , [email, expertType]);

        return res.status(200).send({
            msg : "Success Account Create.",
        })
    }
    catch(err){
        await pg.queryUpdate(`ROLLBACK;`);

        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    finally{
        await pg.queryUpdate(`END;`);
        await pg.disconnect();
    }
}