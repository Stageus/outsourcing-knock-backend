const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');
const array2String = require('../utils/array2String');

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

// 전문가 등록 정보 가져오기
module.exports.getRegisterInfo = async(req, res)=>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);
    
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT E.expert_index, name, email, password, phone_number, expert_type, profile_img_url, id_card_img_url, bankbook_copy_img_url, education, 
                (SELECT ARRAY_AGG(education_img_url) FROM knock.expert_education_img WHERE expert_index = E.expert_index) AS education_img_url, 
                qualification, career, 
                (SELECT ARRAY_AGG(career_img_url) FROM knock.expert_career_img WHERE expert_index = E.expert_index) AS career_img_url
            FROM knock.expert AS E
	            JOIN knock.have_expert_type AS H ON E.expert_index = H.expert_index
	            JOIN knock.expert_type AS T ON H.expert_type_index = T.expert_type_index
            WHERE E.expert_index = $1;
            `
        ,[expertId]);
        
        console.log(result.rows[0].career_img_url);

        if(result.rowCount == 0){
            // 해당하는 expert가 없음
            return res.status(400).send();
        }
        else if(result.rowCount > 1){
            // 같은 id expert가 두 개
            return res.status(400).send();
        }

        return res.status(200).send({
            name : result.rows[0].name,
            email : result.rows[0].email,
            password : result.rows[0].password,
            call : result.rows[0].phone_number, 
            expertType : result.rows[0].expert_type,
            profileImgUrl : result.rows[0].profile_img_url,
            idCardImgUrl : result.rows[0].id_card_img_url,
            bankBookImgUrl : result.rows[0].bankbook_copy_img_url,
            education : result.rows[0].education,
            educationImgUrl : result.rows[0].education_img_url,
            qualification : result.rows[0].qualification,
            career : result.rows[0].career,
            careerImgUrl : result.rows[0].career_img_url,
        });
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

// 전문가 등록 신청
module.exports.register = async(req,res)=>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);

    const education = req.body.education;
    const educationImgUrlList = req.body.educationImgUrl;
    const qualification = req.body.qualification;
    const career = req.body.career;
    const careerImgUrlList = req.body.careerImgUrl;

    try{
        await parameter.nullCheck(education, educationImgUrlList, qualification, career, careerImgUrlList);
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);
        await pg.queryUpdate(
            `
            INSERT INTO knock.register_wait (expert_index) VALUES($1);
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            UPDATE knock.expert SET education = $2, qualification = $3, career = $4 WHERE expert_index = $1;
            `
        , [expertId, education, qualification, career]);

        if(educationImgUrlList.length != 0){
            await pg.queryUpdate(
                `
                DELETE FROM knock.expert_education_img WHERE expert_index = $1;
                `
            , [expertId]);

            await pg.queryUpdate(
                `
                INSERT INTO knock.expert_education_img(expert_index, education_img_url) 
                    VALUES($1, unnest(ARRAY[${array2String.convertArrayFormat(educationImgUrlList)}]));
                `
            , [expertId]);
        }
        if(careerImgUrlList.length != 0){
            await pg.queryUpdate(
                `
                DELETE FROM knock.expert_career_img WHERE expert_index = $1;
                `
            , [expertId]);

            await pg.queryUpdate(
                `
                INSERT INTO knock.expert_career_img(expert_index, career_img_url) 
                    VALUES($1, unnest(ARRAY[${array2String.convertArrayFormat(careerImgUrlList)}]));
                `
            , [expertId]);
        }

        return res.status(200).send({
            msg : "success",
        });
    }
    catch(err){
        await pg.queryUpdate(`ROLLBACK;`);
        if(err instanceof NullParameterError)
            return res.status(400).send({
                msg : "There is null parameter",
            });
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    finally{
        await pg.queryUpdate(`END;`);
        pg.disconnect();
    }
}

// 전문가 비밀번호 찾기
module.exports.resetPassword = async(req, res)=>{
    const pg = new postgres();
    const email = req.body.email;

    try{
        await parameter.nullCheck(email);
        const tmpPassword = Math.random().toString(36).substring(2,11);
        const hashedPassword =  await hasing.createHashedPassword(tmpPassword);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.expert SET password = $1 WHERE email = $2;
            `
        ,[hashedPassword, email])
        
        await mailer.sendMail(tmpPassword, email);
        return res.status(200).send();
    }
    catch(err){
        console.log(err);
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
        await pg.disconnect();
    }
}

// 안심번호 발급
module.exports.issueSafetyNumber = async(req, res)=>{
    // 안심번호 발급 시스템을 전달받은 후 개발
}

// 전문가 프로필 정보 가져오기
module.exports.getProfile = async(req, res) =>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `SELECT E.expert_index AS index, name, ET.expert_type, phone_number, profile_img_url, education, 
                (SELECT ARRAY_AGG(education_img_url) FROM knock.expert_education_img WHERE expert_index = E.expert_index) AS education_img_url,
                qualification, career,
                (SELECT ARRAY_AGG(career_img_url) FROM knock.expert_career_img WHERE expert_index = E.expert_index) AS career_img_url,
                (SELECT ARRAY_AGG(counseling_method) FROM knock.counseling_method_1st AS CM1 JOIN knock.expert_counseling_method_1st AS ECM1 ON CM1.counseling_method_1st_index = ECM1.counseling_method_1st_index
                    WHERE ECM1.expert_index = E.expert_index) AS method1,
                (SELECT ARRAY_AGG(counseling_method) FROM knock.counseling_method_2nd AS CM2 JOIN knock.expert_counseling_method_2nd AS ECM2 ON CM2.counseling_method_2nd_index = ECM2.counseling_method_2nd_index
                    WHERE ECM2.expert_index = E.expert_index) AS method2,
                (SELECT ARRAY_AGG(counseling_method) FROM knock.counseling_method_3rd AS CM3 JOIN knock.expert_counseling_method_3rd AS ECM3 ON CM3.counseling_method_3rd_index = ECM3.counseling_method_3rd_index
                    WHERE ECM3.expert_index = E.expert_index) AS method3,
                (SELECT ARRAY_AGG(type) FROM knock.counseling_type AS CT JOIN knock.expert_counseling_type AS ECT ON CT.counseling_type_index = ECT.counseling_type_index
                    WHERE ECT.expert_index = E.expert_index) AS counseling_type,
                (SELECT row_to_json(ACT) AS available_counseling_time FROM (SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday FROM knock.available_counseling_time) AS ACT), introduction_title, introduction_contents
            FROM knock.expert AS E
                JOIN knock.have_expert_type AS HET ON E.expert_index = HET.expert_index
                JOIN knock.expert_type AS ET ON HET.expert_type_index = ET.expert_type_index
            WHERE E.expert_index = $1;
            `
        , [expertId]);

        if(result.rowCount == 0){
            // 해당 프로필 정보가 없음
            return res.status(400).send();
        }
        else if(result.rowCount > 0){
            // 테이블 내용 오류
            return res.status(400).send();
        }
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
        await pg.disconnect();
    }
}

// 전문가 프로필 정보 수정하기
module.exports.updateProfile = async(req, res) =>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);

    const profileImgUrl = req.body.profileImgUrl;
    const education = req.body.education;
    const educationImgUrlList = req.body.educationImgUrl;
    const qualification = req.body.qualification;
    const career = req.body.career;
    const careerImgUrlList = req.body.careerImgUrl;
    const method1List = req.body.method1;
    const method2List = req.body.method2;
    const method3List = req.body.method3;
    const counselingTypeList = req.body.counselingType;
    const availableTime = req.body.availableTime;
    const introTitle = req.body.introTitle;
    const introContent = req.body.introContent;

    try{
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);
        await pg.queryUpdate(
            `
            UPDATE knock.expert 
                SET profile_img_url = $2,
                education = $3,
                qualification = $4,
                career = $5,
                introduction_title = $6,
                introduction_content = $7
            WHERE expert_index = $1;
            `
        , [expertId, profileImgUrl, education, qualification, career, introTitle, introContent]);
        
        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_education_img WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_education_img VALUES($1, unnest(ARRAY[${array2String.convertArrayFormat(educationImgUrlList)}]));
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_career_img WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_career_img VALUES($1, unnest(ARRAY[${array2String.convertArrayFormat(careerImgUrlList)}]));
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_counseling_method_1st WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_counseling_method_1st 
            VALUES($1, (SELECT counseling_method_1st_index FROM knock.counseling_method_1st WHERE counseling_method in $2));
            `
        , [expertId, method1List]);

        res.status(200).send('test');
    }
    catch(err){
        pg.queryUpdate(`ROLLBACK`);
    }
    finally{
        pg.queryUpdate(`END;`);
        pg.disconnect();
    }
}