const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');
const array2String = require('../utils/array2String');
const phoneValidation = require('../utils/phoneValidation');

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

// dev_shin---start

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
            `
            SELECT E.expert_index AS index, name, ET.expert_type, phone_number, profile_img_url, education, 
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
            console.log("프로필 정보가 없음");
            return res.status(400).send();
        }
        else if(result.rowCount > 1){
            // 테이블 내용 오류
            console.log("테이블 내용 오류");
            return res.status(400).send();
        }

        return res.status(200).send(
            result // result를 그대로 보내지마
        );
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
        await parameter.nullCheck(profileImgUrl, education, educationImgUrlList, qualification, career, careerImgUrlList, method1List, method2List, method3List, counselingTypeList, availableTime, introTitle, introContent);
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
                introduction_contents = $7
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

        // counseling method
        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_counseling_method_1st WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_counseling_method_1st
            VALUES($1, unnest(ARRAY[(SELECT ARRAY_AGG(counseling_method_1st_index) FROM knock.counseling_method_1st WHERE counseling_method in (${array2String.convertArrayFormat(method1List)}))]));
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_counseling_method_2nd WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_counseling_method_2nd
            VALUES($1, unnest(ARRAY[(SELECT ARRAY_AGG(counseling_method_2nd_index) FROM knock.counseling_method_2nd WHERE counseling_method in (${array2String.convertArrayFormat(method2List)}))]));
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_counseling_method_3rd WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_counseling_method_3rd
            VALUES($1, unnest(ARRAY[(SELECT ARRAY_AGG(counseling_method_3rd_index) FROM knock.counseling_method_3rd WHERE counseling_method in (${array2String.convertArrayFormat(method3List)}))]));
            `
        , [expertId]);
        //

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_counseling_type WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_counseling_type
            VALUES(unnest(ARRAY[(SELECT ARRAY_AGG(counseling_type_index) FROM knock.counseling_type WHERE type in (${array2String.convertArrayFormat(counselingTypeList)}))]), $1);
            `
        , [expertId]);
        
        await pg.queryUpdate(
            `
            UPDATE knock.available_counseling_time 
            SET monday = $2, tuesday = $3, wednesday = $4, thursday = $5, friday = $6, saturday = $7, sunday = $8 WHERE expert_index = $1;
            `
        , [expertId, availableTime.Monday, availableTime.Tuesday, availableTime.Wednesday, availableTime.Thursday, availableTime.Friday, availableTime.Saturday, availableTime.Sunday]);

        return res.status(200).send();
    }
    catch(err){
        await pg.queryUpdate(`ROLLBACK`);

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

// 안심번호 변경
module.exports.changeSafetyNumber = async(req,res)=>{
    // 안심번호 발급 시스템을 전달받은 후 개발
}

// 전문가 회원 정보 가져오기
module.exports.getExpertInfo = async(req,res)=>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT name, email, phone_number AS call, (expert_status = 'dormancy') AS dormancy, (SELECT ARRAY_AGG(career_img_url) AS career_img_url FROM knock.expert_career_img)  
            FROM knock.expert
            WHERE expert_index = $1;
            `
        , [expertId]);

        return res.status(200).send(result.rows[0]);
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

// 전문가 회원 정보 수정하기
module.exports.updateExpertInfo = async(req,res)=>{
    const pg = new postgres();
    const expertId = parseInt(req.params.expertId);

    const password = req.body.password;
    const hashedPassword = await hasing.createHashedPassword(password);
    const call = req.body.call;
    const dormancy = req.body.dormancy;
    let expertStatus = '';
    if(dormancy){expertStatus = 'dormancy';}
    const careerImgUrlList = req.body.careerImgUrl;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);
        await pg.queryUpdate(
            `
            UPDATE knock.expert 
            SET password = $1, phone_number = $2, expert_status = $3
            WHERE expert_index = $4;
            `
        , [hashedPassword, call, expertStatus, expertId]);

        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_career_img
            WHERE expert_index = $1;
            `
        , [expertId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.expert_career_img
            VALUES ($1, unnest(ARRAY[${array2String.convertArrayFormat(careerImgUrlList)}]));
            `
        , [expertId]);

        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        await pg.queryUpdate(`ROLLBACK;`);
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

// (미완) 휴대폰 인증하기
module.exports.phoneValidation = async(req,res)=>{
    const expertId = req.params.expertId;
    const phoneNubmer = req.params.phone;

    try{
        parameter.nullCheck(phoneNubmer);
        const resultCode = await phoneValidation.send_message(phoneNubmer, "SMS 인증번호 발송용 테스트 메일입니다.");
        console.log(resultCode);
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
    }
    res.status(200).send();
}

// 상담목록 전체개수 
module.exports.getTotalCounseling = async(req,res)=>{
    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT COUNT(*) FROM knock.psychology_payment;
            `
        , []);

        res.status(200).send(result.rows[0]);
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

// 상담 목록 가져오기
module.exports.getCounselingList = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const searchType = req.params.searchType;
    const description = req.params.description;
    const progress = req.params.progress;
    const counselingType = req.params.counselingType;
    const startDate = req.params.startDate;
    const endDate = req.params.endDate;
    const pageCount = req.params.pagecount;
    const pagePerRow = 5; // 페이지당 row 개수

    // make where clause
    let whereClause = ``;
    if(searchType != "empty" && description != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        if(searchType === "결제상품번호"){
            whereClause += `PP.payment_info_index = ${description} `;
        }
        else if(searchType === "회원번호"){
            whereClause += `PP.user_index = ${description} `;
        }
        else if(searchType === "닉네임"){
            whereClause += `nickname = '${description}' `;
        }
    }

    if(progress != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        whereClause += `(SELECT title FROM knock.progress_message WHERE SP.progress_message_index = progress_message_index) = '${progress}' `;
    }
    if(counselingType != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        whereClause += `counseling_type = '${counselingType}' `;
    }
    if(startDate != "empty" && endDate != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        whereClause += `'${startDate}'::date <= consultation_time::date AND consultation_time::date <= '${endDate}'`;
    }
    
    if(whereClause != "") whereClause = `WHERE PP.expert_index = ${expertId} AND ` + whereClause;
    console.log(whereClause);

    try{
        parameter.nullCheck(); // null check
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT PP.payment_info_index AS product_index, PP.user_index, nickname AS user_nickname, counseling_type, is_canceled, 
            (SELECT title FROM knock.progress_message WHERE SP.progress_message_index = progress_message_index) AS progress,
            consultation_time AS time
            FROM knock.psychology_payment AS PP
            JOIN knock.users AS U ON PP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON PP.payment_info_index = PI.payment_info_index
            JOIN knock.service_progress AS SP ON PP.payment_info_index = SP.payment_info_index
            ${whereClause} 
            OFFSET ${pagePerRow * (pageCount-1)} LIMIT ${pagePerRow * pageCount};
            `
        );

        console.log(result.rows);
        if(result.rowCount === 0){
            return res.status(400).send('해당하는 상품이 없습니다.');
        }

        return res.status(200).send({
            counseling : result.rows
        });
    }
    catch(err){
        console.log(err);
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

// 상담 목록 상세보기
module.exports.getCounseling = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productId = req.params.productId;

    try{
        parameter.nullCheck(expertId, productId);
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT PP.payment_info_index AS product_index, PP.user_index, nickname AS user_nickname, counseling_type, is_canceled, consultation_time AS time, 
            (SELECT EXISTS(SELECT * FROM knock.pre_question_answer WHERE psychology_payment_index = PP.psychology_payment_index)) AS apply_prequestion,
            (SELECT title FROM knock.progress_message WHERE SP.progress_message_index = progress_message_index) AS progress,
            (SELECT EXISTS(SELECT * FROM knock.expert_review WHERE payment_info_index = PP.payment_info_index)) AS apply_review
            FROM knock.psychology_payment AS PP
            JOIN knock.users AS U ON PP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON PP.payment_info_index = PI.payment_info_index
            JOIN knock.service_progress AS SP ON PP.payment_info_index = SP.payment_info_index
            WHERE PP.expert_index = $1 AND PP.payment_info_index = $2;
            `
        , [expertId, productId]);

        if(result.rowCount === 0){
            return res.status(400).send("해당하는 상품이 없습니다.");
        }

        return res.status(200).send(result.rows[0]);
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

// 상담 목록 - 상세 수정 사항 저장
module.exports.updateCounseling = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productId = req.params.productId;
    const counselingTime = req.body.time;
    const progress = req.body.progress;

    try{
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);

        await pg.queryUpdate(
            `
            UPDATE knock.psychology_payment SET consultation_time = $1
            WHERE payment_info_index = $2 AND expert_index = $3;
            `
        , [counselingTime, productId, expertId]);

        await pg.queryUpdate(
            `
            UPDATE knock.service_progress SET progress_message_index = (SELECT progress_message_index FROM knock.progress_message WHERE title = $1)
            WHERE payment_info_index = $2;
            `
        , [progress, productId]);

        return res.status(200).send();
    }
    catch(err){
        await pg.queryUpdate(`ROLLBACK;`);
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

// 상담 목록 - 사전질문 보기
module.exports.getPrequestion = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productId = req.params.productId;

    try{
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT ARRAY_AGG(answer) AS answer FROM knock.pre_question_answer
            WHERE payment_info_index = $1;
            `
        , [productId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }

        return res.status(200).send(result.rows[0]);
    }
    catch(err){
        console.log(err);
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

// 상담 목록 - 후기 보기
module.exports.getReview = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productId = req.params.productId;

    try{
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT reviews, writed_at FROM knock.expert_review 
            WHERE expert_index = $1 AND payment_info_index = $2;
            `
        , [expertId, productId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send(result.rows[0]);
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

// 상담 목록 - 채팅방 입장
module.exports.joinChatRoom = async(req,res)=>{
    const pg = new postgres();
    
    const expertId = req.params.expertId;
    const productId = req.params.productId;

    try{
        await pg.connect();

        await pg.queryUpdate(`BEGIN;`);
        const result = await pg.queryExecute(
            `
            INSERT INTO knock.room (user_index, expert_index, created_at) 
            VALUES((SELECT user_index FROM knock.psychology_payment WHERE payment_info_index = $1), $2, NOW())
            RETURNING room_index;
            `
        , [productId, expertId]);

        const roomIndex = result.rows[0].room_index;

        await pg.queryUpdate(
            `
            INSERT INTO knock.room_payment_history VALUES($1, $2);
            `
        , [productId, roomIndex]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.participant (room_index, user_index, expert_index, not_read_chat, last_read_chat_id) 
            VALUES($1, (SELECT user_index FROM knock.psychology_payment WHERE payment_info_index = $2), null, 0, 0), ($1, null, $3, 0, 0);
            `
        , [roomIndex, productId, expertId]);

        return res.status(200).send();
    }
    catch(err){
        await pg.queryUpdate(`ROLLBACK;`);
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

// dev_shin---end

// dev_Lee---start
module.exports.getExpertsList = async(req,res) =>{
    const pg = new postgres();
    const firstCategory = req.params.firstcategory;
    const secondCategory = req.params.secondcategory;
    const thirdCategory = req.params.thirdcategory;
    const pageCount = (req.params.pagecount-1) * 30;

    try{
        await parameter.nullCheck(firstCategory, secondCategory, thirdCategory, pageCount);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index AS expert_id, name, introduction_contents AS introduction, profile_img_url,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = expert.expert_index) AS review_count,
            (SELECT expert_type AS type FROM knock.have_expert_type INNER JOIN knock.expert_type ON have_expert_type.expert_type_index = expert_type.expert_type_index WHERE have_expert_type.expert_index = expert.expert_index),
            (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index WHERE expert_counseling_type.expert_index = expert.expert_index) AS type
            FROM knock.expert 
            WHERE expert_index IN (SELECT expert_index FROM knock.counseling_method_1st INNER JOIN knock.expert_counseling_method_1st ON expert_counseling_method_1st.counseling_method_1st_index = counseling_method_1st.counseling_method_1st_index WHERE counseling_method = $1)
            AND expert_index IN (SELECT expert_index FROM knock.counseling_method_2nd INNER JOIN knock.expert_counseling_method_2nd ON expert_counseling_method_2nd.counseling_method_2nd_index = counseling_method_2nd.counseling_method_2nd_index WHERE counseling_method = $2)
            AND expert_index IN (SELECT expert_index FROM knock.counseling_method_3rd INNER JOIN knock.expert_counseling_method_3rd ON expert_counseling_method_3rd.counseling_method_3rd_index = counseling_method_3rd.counseling_method_3rd_index WHERE counseling_method = $3)
            LIMIT 30 OFFSET $4
            `
        ,[firstCategory, secondCategory, thirdCategory, pageCount])

        return res.status(200).send({
            bannerList : result.rows
        })
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof NullParameterError)
            return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.getExpertDetail = async(req, res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert.expert_index, profile_img_url, name, 
            (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON have_expert_type.expert_index= $1 AND expert_type.expert_type_index = have_expert_type.expert_type_index),
            (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON expert_counseling_type.expert_index = $1 AND counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index) AS counseling_type,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = $1) AS review_count, introduction_title, introduction_contents, (SELECT array_agg(counseling_method) FROM knock.counseling_method_2nd INNER JOIN knock.expert_counseling_method_2nd ON expert_counseling_method_2nd.expert_index = $1 AND expert_counseling_method_2nd.counseling_method_2nd_index = counseling_method_2nd.counseling_method_2nd_index) AS counseling_type, qualification, career, education, monday, tuesday, wednesday, thursday, friday, saturday, sunday  FROM knock.expert INNER JOIN knock.available_counseling_time ON expert.expert_index= $1 AND expert.expert_index = available_counseling_time.expert_index;
            `
        ,[expertId])

        return res.status(200).send(result.rows[0])
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
        return res.status(500).send();
    
    if(err instanceof SqlSyntaxError)
        return res.status(500).send();

    if(err instanceof NullParameterError)
        return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }
}

//TODO 결제 테이블 완성되면 쿼리 짜기. 지금은 상담방식을 가져올 수 없음
module.exports.getBestReview = async(req,res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, user_index AS user_id, 
            `
        [expertId]);
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
        return res.status(500).send();
    
        if(err instanceof SqlSyntaxError)
        return res.status(500).send();

        if(err instanceof NullParameterError)
        return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }

}

//TODO 결제 테이블 완성되면 쿼리 짜기
module.exports.getReviewList = async(req,res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            `
        [expertId]);
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
        return res.status(500).send();
    
        if(err instanceof SqlSyntaxError)
        return res.status(500).send();

        if(err instanceof NullParameterError)
        return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }
}

// dev_Lee---end