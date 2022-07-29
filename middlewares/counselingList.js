const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');

// 상담 목록 가져오기
module.exports.getCounselingList = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const searchType = req.params.searchType;
    const description = req.params.description;
    const progress = req.params.progress;
    const counselingTypeChatting = req.params.counselingTypeChatting;
    const counselingTypeVoice = req.params.counselingTypeVoice;
    const startDate = req.params.startDate;
    const endDate = req.params.endDate; 

    // make where clause
    let whereClause = ``;
    whereClause = `WHERE PP.expert_index = ${expertId} `;

    if(searchType != "empty" && description != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        if(searchType === "결제상품번호"){
            whereClause += `PP.payment_key = ${description} `;
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
        whereClause += `counseling_status = '${progress}' `;
    }

    if(counselingTypeChatting == 'true' || counselingTypeVoice == 'true'){
        if (whereClause != "") {
            whereClause += "AND ";
          }
          let type = "";
          if (counselingTypeChatting == 'true') { type += "'채팅'"; }
          if (counselingTypeVoice == 'true') {
            if (type != "") { type += ", "; }
            type += "'음성'";
          }
          whereClause += `counseling_type in (${type}) `;
    }

    if(startDate != "empty" && endDate != "empty"){
        if(whereClause != ""){ whereClause += "AND "; }
        whereClause += `'${startDate}'::date <= consultation_time::date AND consultation_time::date <= '${endDate}'`;
    }
    
    console.log(whereClause);

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT PP.payment_key AS product_key, PP.user_index, nickname AS user_nickname, counseling_type,
             (status = 'CANCEL') AS is_canceled, counseling_status, TO_CHAR(counseling_start_time, 'YYYY.MM.DD / HH:MI') AS time
            FROM knock.psychology_payment AS PP
            JOIN knock.users AS U ON PP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON PP.payment_key = PI.payment_key
            ${whereClause} 
            `
        );

        const count = await pg.queryExecute(
            `
            SELECT CEIL(COUNT(*) / 10.0)
            FROM knock.psychology_payment AS PP
            JOIN knock.users AS U ON PP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON PP.payment_key = PI.payment_key
            ${whereClause}
            `
        );

        console.log(result.rows);
        if(result.rowCount === 0){
            return res.status(400).send('해당하는 상품이 없습니다.');
        }

        return res.status(200).send({
            counselingList : result.rows,
            pageCount : count.rowCount,
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
    const productId = req.params.productId;

    try{
        parameter.nullCheck(productId);
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT PP.payment_key AS product_key, PP.user_index, nickname AS user_nickname, counseling_type, 
            (status = 'CANCEL') AS is_canceled, CONCAT(TO_CHAR(counseling_start_time, 'YYYY.MM.DD / HH:MI-'), TO_CHAR(counseling_end_time, 'HH:MI')) AS time,
            counseling_start_time AS start_time, counseling_end_time AS end_time
            (SELECT EXISTS(SELECT * FROM knock.pre_question_answer WHERE payment_key = PP.payment_key)) AS apply_prequestion,
            counseling_status,
	        (SELECT EXISTS(SELECT * FROM knock.expert_review WHERE payment_key = PP.payment_key)) AS apply_review
            FROM knock.psychology_payment AS PP
            JOIN knock.users AS U ON PP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON PP.payment_key = PI.payment_key
            WHERE PP.payment_key = $1;
            `
        , [productId]);

        if(result.rowCount === 0){
            return res.status(400).send("해당하는 상품이 없습니다.");
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

// 상담 목록 - 상세 수정 사항 저장
// TODO : 진행상태에 따라서 다른 처리
// TODO : push 알림 추가
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
            WHERE payment_key = $2 AND expert_index = $3;
            `
        , [counselingTime, productId, expertId]);

        await pg.queryUpdate(
            `
            UPDATE knock.payment_info SET counseling_status = $1
            WHERE payment_key = $2;
            `
        , [progress, productId]);

        if(progress == "일정조율"){
            const result = await pg.queryExecute( // 알람
                `
                WITH product_id as (SELECT payment_key FROM knock.payment_info WHERE payment_key = $1),
                weekday AS (SELECT EXTRACT(DOW FROM (SELECT counseling_start_time FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id) )) AS weekday)
                
                INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at)
                VALUES(
                    (SELECT user_index from knock.payment_info WHERE payment_key = (SELECT payment_key FROM product_id)), (SELECT payment_key FROM product_id), false,
                    (SELECT CONCAT('🔔전문가와 상담 일정이 확정되었습니다.\n-예약시간', 
                    (SELECT TO_CHAR(counseling_start_time, 'YYYY-MM-DD') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)),
                    (SELECT CASE 
                            WHEN weekday =0 THEN '(일)'
                            WHEN weekday = 1 THEN '(월)'
                            WHEN weekday = 2 THEN '(화)'
                            WHEN weekday = 3 THEN '(수)'
                            WHEN weekday = 4 THEN '(목)'
                            WHEN weekday = 5 THEN '(금)'
                            WHEN weekday = 6 THEN '(토)'
                        ELSE '(?)'
                        END from weekday),
                    (SELECT TO_CHAR(counseling_start_time, 'AM hh12:mi-') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)),
                    (SELECT TO_CHAR(counseling_end_time, 'hh12:mi') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)) ) AS title FROM weekday),
                    '상담 일정변경은 상담 당일 이전까지 변경 가능합니다.', NOW()
                )
                RETURNING title, content;
                `
            , [productId]);

            await pg.queryUpdate( // 채팅
                `
                WITH product_id AS (SELECT payment_key FROM knock.payment_info WHERE payment_key = $1),
                room_info AS (SELECT room_index FROM knock.room_payment_history WHERE payment_key = (SELECT payment_key FROM product_id)),
                psychology_info AS (SELECT expert_index FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id))
                
                INSERT INTO knock.chatting (room_index, sender_index, message, created_at, is_alarm)
                VALUES(
                    (SELECT room_index FROM room_info),
                    (SELECT expert_index FROM psychology_info),
                    CONCAT($2, '/', $3), NOW(), true
                )                
                `
            , [productId, result.rows[0].title, result.rows[0].content]);

            // TODO: push알림 보내기
        }
        else if(progress == "일정확정"){
            const result = await pg.queryExecute( // 알람
                `
                WITH product_id as (SELECT payment_key FROM knock.payment_info WHERE payment_key = $1),
                weekday AS (SELECT EXTRACT(DOW FROM (SELECT counseling_start_time FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id) )) AS weekday)
                
                INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at)
                VALUES((SELECT user_index from knock.payment_info WHERE payment_key = (SELECT payment_key FROM product_id)), (SELECT payment_key FROM product_id), false,
                (SELECT CONCAT('🔔전문가와 상담 일정이 변경되었습니다.\n-예약시간', 
                (SELECT TO_CHAR(counseling_start_time, 'YYYY-MM-DD') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)),
                (SELECT CASE 
                        WHEN weekday =0 THEN '(일)'
                        WHEN weekday = 1 THEN '(월)'
                        WHEN weekday = 2 THEN '(화)'
                        WHEN weekday = 3 THEN '(수)'
                        WHEN weekday = 4 THEN '(목)'
                        WHEN weekday = 5 THEN '(금)'
                        WHEN weekday = 6 THEN '(토)'
                    ELSE '(?)'
                    END from weekday),
                (SELECT TO_CHAR(counseling_start_time, 'AM hh12:mi-') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)),
                (SELECT TO_CHAR(counseling_end_time, 'hh12:mi') FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id)) ) AS title FROM weekday),
                '상담 일정변경은 상담 당일 이전까지 변경 가능합니다.', NOW()
                )
                RETURNING title, content;
                `
            , [productId]);

            await pg.queryUpdate( // 채팅
                `
                WITH product_id AS (SELECT payment_key FROM knock.payment_info WHERE payment_key = $1),
                room_info AS (SELECT room_index FROM knock.room_payment_history WHERE payment_key = (SELECT payment_key FROM product_id)),
                psychology_info AS (SELECT expert_index FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id))
                
                INSERT INTO knock.chatting (room_index, sender_index, message, created_at, is_alarm)
                VALUES(
                    (SELECT room_index FROM room_info),
                    (SELECT expert_index FROM psychology_info),
                    CONCAT($2, '/', $3), NOW(), true
                )
                `
            , [productId, result.rows[0].title, result.rows[0].content]);

            // TODO: push 알림 보내기
        }
        else if(progress == "상담중"){
            const result = await pg.queryUpdate( // 알림
                `
                WITH product_id AS (SELECT payment_key, user_index FROM knock.payment_info WHERE payment_key = $1),
                user_name AS (SELECT nickname FROM knock.users WHERE user_index = (SELECT user_index FROM product_id))
                
                INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at)
                VALUES(
                    (SELECT user_index from knock.payment_info WHERE payment_key = (SELECT payment_key FROM product_id)), 
                    (SELECT payment_key FROM product_id), 
                    false,
                    (SELECT CONCAT( 
                        (SELECT nickname FROM user_name),
                        '님, 상담은 만족스러우셨나요? 더 좋은 서비스를 만들 수 있도록 소중한 후기를 남겨주세요.'
                    )),
                    '상담 일정변경은 상담 당일 이전까지 변경 가능합니다.', NOW()
                )
                RETURNING title, content;
                `
            , [productId]);

            await pg.queryUpdate( // 서비스 이용내역
                `
                WITH product_id AS (SELECT payment_key, user_index FROM knock.payment_info WHERE payment_key = $1)

                INSERT INTO knock.service_progress (payment_key, created_at, title, content)
                VALUES(
                    (SELECT payment_key FROM product_id),
                    NOW(), $2, $3
                )
                `
            , [productId, result.rows[0].title, result.rows[0].content]);

            await pg.queryUpdate( // 채팅
                `
                WITH product_id AS (SELECT payment_key FROM knock.payment_info WHERE payment_key = $1),
                room_info AS (SELECT room_index FROM knock.room_payment_history WHERE payment_key = (SELECT payment_key FROM product_id)),
                psychology_info AS (SELECT expert_index FROM knock.psychology_payment WHERE payment_key = (SELECT payment_key FROM product_id))
                
                INSERT INTO knock.chatting (room_index, sender_index, message, created_at, is_alarm)
                VALUES(
                    (SELECT room_index FROM room_info),
                    (SELECT expert_index FROM psychology_info),
                    CONCAT($2, '/', $3), NOW(), true
                )
                `
            , [productId, result.rows[0].title, result.rows[0].content]);

            // TODO: push 알림 보내기
        }

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
    const productId = req.params.productId;

    try{
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT ARRAY_AGG(answer) AS answer FROM knock.pre_question_answer
            WHERE payment_key = $1;
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
            WHERE expert_index = $1 AND payment_key = $2;
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
            VALUES((SELECT user_index FROM knock.psychology_payment WHERE payment_key = $1), $2, NOW())
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
            VALUES($1, (SELECT user_index FROM knock.psychology_payment WHERE payment_key = $2), null, 0, 0), ($1, null, $3, 0, 0);
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

// 상담 목록 - 상담일정 확정 / 변경 
module.exports.setCounselingDate = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productId = req.params.productId;
    const counselingDate = req.body.time;
    const action = req.body.action;

    const alarm_title = `전문가와 상담 일정이 ${action}되었습니다.\n- 예약시간 ${counselingDate}`;
    const alarm_content = `상담 일정변경은 상담 당일 이전까지 변경 가능합니다.`;

    try{
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);
        await pg.queryUpdate(
            `
            UPDATE knock.psychology_payment SET consultation_time = $3
            WHERE payment_key = $1 AND expert_index = $2;
            `
        , [productId, expertId, counselingDate]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at) 
            VALUES((SELECT user_index FROM knock.psychology_payment WHERE payment_key = $1), $1, false, $2, $3, NOW());
            `
        , [productId, alarm_title, alarm_content]);

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

// 상담 목록 - 상담 개시
// TODO: 채팅방 알림 추가
module.exports.beginCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    const alarm_title = `지금부터 상담이 시작됩니다.`;
    const alarm_content = `상담 시작을 위해 '상담 동의서'를 확인해주세요.`;

    try{
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);

        await pg.queryUpdate(
            `
            UPDATE knock.payment_info SET counseling_status = '상담중'
            WHERE payment_key = $1;
            `
        , [productId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at) 
            VALUES((SELECT user_index FROM knock.psychology_payment WHERE payment_key = $1), $1, false, $2, $3, NOW());
            `
        , [productId, alarm_title, alarm_content]);

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

// 상담 목록 - 상담 종료
module.exports.endCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    const alarm_title = `상담이 종료되었습니다.`;
    const alarm_content = `님, 상담은 만족스러우셨나요? 더 좋은 서비스를 만들 수 있도록 소중한 후기를 남겨주세요.`;

    try{    
        await pg.connect();
        await pg.queryUpdate(`BEGIN;`);

        await pg.queryUpdate(
            `
            UPDATE knock.payment_info SET counseling_status = '상담종료'
            WHERE payment_key = $1;
            `
        , [productId]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.alarm (user_index, payment_key, is_checked, title, content, created_at) 
            VALUES((SELECT user_index FROM knock.psychology_payment WHERE payment_key = $1), $1, false, $2, $3, NOW());
            `
        , [productId, alarm_title, alarm_content]);

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

// 상담 목록 - 배정 취소
module.exports.cancelCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    try{
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.payment_info SET counseling_status = '배정취소'
            WHERE payment_key = $1;
            `
        , [productId]);

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