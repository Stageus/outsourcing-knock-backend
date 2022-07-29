const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');

// 채팅방 목록 가져오기 (소켓)
module.exports.getChatRoomList = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT (SELECT nickname FROM knock.users WHERE user_index = R.user_index), not_read_chat, last_read_chat_id, is_terminated FROM knock.room AS R
            JOIN knock.participant AS P ON R.room_index = P.room_index
            WHERE R.expert_index = $1;
            `
        , [expertId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send({
            rooms : result.rows
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

// 채팅 내용 가져오기 (소켓)
module.exports.getChattingList = async(req,res)=>{
    const pg = new postgres();
    const roomId = req.params.roomId;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT chatting_index, sender_index, message, created_at, is_alarm FROM knock.chatting
            WHERE room_index = $1;
            `
        , [roomId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send({
            chatting : result.rows,
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

// 진행중 상담 불러오기 (소켓)
module.exports.getProgressingList = async(req,res)=>{
    const pg = new postgres();
    const roomId = req.params.roomId;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT PI.payment_key, product_name, counseling_status, payment_date
            FROM knock.payment_info AS PI
            JOIN knock.psychology_payment AS PP ON PI.payment_key = PP.payment_key
            JOIN knock.test_payment AS TP ON PI.payment_key = TP.payment_key
            JOIN knock.room_payment_history AS RPH ON PI.payment_key = RPH.payment_key
            WHERE RPH.room_index = $1;            
            `
        , [roomId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send({
            counseling:result.rows,
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

// 자주 쓰는 메시지 불러오기
module.exports.getMacro = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT macro_message_index, message FROM knock.macro_message
            WHERE expert_index = $1;
            `
        , [expertId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send(result.rows);
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

// 자주 쓰는 메시지 저장 / 수정하기
module.exports.updateMacro = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const macroMessage = req.body.macroMessage;

    try{
        parameter.nullCheck(macroMessage);
        await pg.connect();
        await pg.queryUpdate(
            `
            SELECT message FROM knock.macro_message
            WHERE expert_index = $1 AND macro_message_index = $2;
            `
        , [expertId, macroMessage]);

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