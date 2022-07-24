const express = require("express");
const app = express();
const http = require("http").createServer(app);
const {PostgreConnectionError, SqlSyntaxError} = require("./errors/error");
const io = require('socket.io')(http, {
	cors :{
		origin : "*",
		methods:["GET", "POST"]
	}
});
const postgres = require('./database/pg');

var port = 3000;
http.listen(port, () => {
  console.log("listening on *:" + port);
});

io.on('connection', (socket)=> {
    socket.emit('connectmsg', '연결됨');

    getChatting(socket);
    createRoom(socket);
    disconnect(socket);
    getRoomList(socket);
    joinRoom(socket);
    message(socket);
    readChat(socket);    
    debug(socket, io);
});

// 실질적으로 socket.io에 create room기능은 join room시 생성되지만 DB table에는 별도로 처리해야함
// 
const createRoom = (socket) =>{
    socket.on('createRoom', async(createRoomObj)=>{
        const { user_id, expert_id } = createRoomObj;
        const pg = new postgres();

        try{
            await pg.connect();

            await pg.queryUpdate(`BEGIN;`)
            const result = await pg.queryExecute(
                `
                INSERT INTO knock.room (user_index, expert_index, created_at) VALUES($1, $2, NOW() + '9 hour'::interval)
                RETURNING room_index;
                `
            , [parseInt(user_id), parseInt(expert_id)]);

            // TODO : 예외처리
            const roomId = result.rows[0].room_index;

            await pg.queryUpdate(
                `
                INSERT INTO knock.participant (room_index, user_index, expert_index, not_read_chat, last_read_chat_id) VALUES($1,$2,null,0,0);
                `
            , [roomId, parseInt(user_id)]);

            await pg.queryUpdate(
                `
                INSERT INTO knock.participant (room_index, user_index, expert_index, not_read_chat, last_read_chat_id) VALUES($1,null,$2,0,0);
                `
            , [roomId, parseInt(expert_id)]);
        }
        catch(err){
            await pg.queryUpdate(`ROLLBACK`);
            console.log(err);
        }
        finally{
            await pg.queryUpdate(`END;`);
            socket.emit('createRoom', 'complete');
            await pg.disconnect();
        }
    });
}

const disconnect = (socket) => {
    socket.on('disconnect-user', async(requestObj) => {
        // leave room 처리 및 database에 적용
        const {room_id, user_id} = requestObj;
        socket.leave(room_id);

        const pg = new postgres();
        const responseObj = {
            result:null,
            errmsg:null,
        };

        try{
            await pg.connect();
            
            const result = await pg.queryExecute(
                `
                SELECT R.room_index, user_index, R.expert_index, is_terminated, name, profile_img_url,
                (SELECT message FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_message,
                (SELECT created_at FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_time,
                (SELECT sender_index FROM knock.chatting WHERE chatting_index = R.last_chat_index),
                (SELECT expert_type FROM knock.expert_type WHERE expert_type_index = HET.expert_type_index),
                (SELECT not_read_chat FROM knock.participant WHERE room_index = R.room_index AND user_index = $1)
                FROM knock.room AS R
                JOIN knock.expert AS E ON R.expert_index = E.expert_index
                JOIN knock.have_expert_type AS HET ON E.expert_index = HET.expert_index
                WHERE user_index = $1;
                `
            , [user_id]);

            if(result.rowCount != 0){
                responseObj.result = result.rows;
            }
            else{
                console.log("err : rowCount is 0");
                responseObj.errmsg = `err : rowCount is 0`;
            }

            responseObj.result = result.rows;
        }
        catch(err){
            console.log(err);
            responseObj.errmsg = err;
        }
        finally{
            socket.emit('roomList-user', responseObj);
            await pg.disconnect();
        }
    });

    socket.on('disconnect-expert', (requestObj) => {
        // leave room 처리 및 database에 적용
        const {room_id, user_id} = requestObj;
        socket.leave(room_id);
        socket.disconnect();

        const responseObj = {
            result:"방을 나갔습니다",
            errmsg:null,
        };
        socket.emit('disconnect-expert', responseObj);
    });
}

const getRoomList = (socket) => {
    socket.on('roomList-user', async(user_id)=>{
        // 유저가 속한 room 리스트 반환
        const pg = new postgres();

        const responseObj = {
            result:null,
            errmsg:null,
        };

        try{
            await pg.connect();
            
            const result = await pg.queryExecute(
                `
                SELECT R.room_index, user_index, R.expert_index, is_terminated, name, profile_img_url,
                (SELECT message FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_message,
                (SELECT created_at FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_time,
                (SELECT sender_index FROM knock.chatting WHERE chatting_index = R.last_chat_index),
                (SELECT expert_type FROM knock.expert_type WHERE expert_type_index = HET.expert_type_index),
                (SELECT not_read_chat FROM knock.participant WHERE room_index = R.room_index AND user_index = $1)
                FROM knock.room AS R
                JOIN knock.expert AS E ON R.expert_index = E.expert_index
                JOIN knock.have_expert_type AS HET ON E.expert_index = HET.expert_index
                WHERE user_index = $1;
                `
            , [user_id]);

            if(result.rowCount != 0){   
                responseObj.result = result.rows;
            }
            else{
                console.log("err : rowCount is 0");
                responseObj.errmsg = `err : rowCount is 0`;
            }

            responseObj.result = result.rows;
        }
        catch(err){
            console.log(err);
            responseObj.errmsg = err;
        }
        finally{
            socket.emit('roomList-user', responseObj);
            await pg.disconnect();
        }
    })

    // need modify
    socket.on('roomList-expert', async(expert_id)=>{
        // 전문가가 속한 room 리스트 반환
        const pg = new postgres();

        const responseObj = {
            result:null,
            errmsg:null,
        };

        try{
            await pg.connect();
            
            const result = await pg.queryExecute(
                `
                SELECT R.room_index, R.user_index, R.expert_index, is_terminated,
	            (SELECT nickname FROM knock.users WHERE user_index = R.user_index) AS name,
                (SELECT message FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_message,
                (SELECT created_at FROM knock.chatting WHERE chatting_index = R.last_chat_index) AS last_chat_time,
                (SELECT sender_index FROM knock.chatting WHERE chatting_index = R.last_chat_index),
                (SELECT not_read_chat FROM knock.participant WHERE room_index = R.room_index AND expert_index = R.expert_index)
                FROM knock.room AS R
                WHERE expert_index = $1;
                `
            , [expert_id]);

            responseObj.result = result.rows;
        }
        catch(err){
            console.log(err);
            responseObj.errmsg = err;
        }
        finally{
            socket.emit('roomList-expert', responseObj);
            await pg.disconnect();
        }
    })
}

const joinRoom = (socket) => {
    socket.on('join-user', async (joinObj) => {
        const {room_id, user_id} = joinObj;
        socket.join(room_id);

        const pg = new postgres();

        const responseObj = {
            result : null,
            errmsg : null,
        };

        try{
            await pg.connect();

            const result = await pg.queryExecute(
                `
                SELECT participant_index, last_read_chat_id FROM knock.participant 
                WHERE room_index = $1 AND user_index = $2;
                `
            , [room_id, user_id]);

            if(result.rowCount != 0){
                responseObj.result = result.rows[0];
            }
            else{
                console.log("err : rowCount is 0");
                responseObj.errmsg = `err : rowCount is 0`;
            }
        }
        catch(err){
            console.log(err);
            responseObj.errmsg = err;
        }
        finally{
            socket.emit('join-user', responseObj);
            await pg.disconnect();
        }
    })

    // need modify
    socket.on('join-expert', async (joinObj) => {
        const {room_id, user_id} = joinObj;
        socket.join(room_id);

        const pg = new postgres();
        const responseObj = {
            result : null,
            errmsg : null,
        };

        try{
            await pg.connect();

            const result = await pg.queryExecute(
                `
                SELECT participant_index, last_read_chat_id FROM knock.participant 
                WHERE room_index = $1 AND expert_index = $2;
                `
            , [room_id, user_id]);

            // TODO : rows의 개수 예외처리
            if(result.rowCount != 0){
                responseObj.result = result.rows[0];
            }
            else{
                console.log("err : rowCount is 0");
                responseObj.errmsg = "err : rowCount is 0";
            }
        }
        catch(err){
            console.log(err);
            responseObj.errmsg = err;
        }
        finally{
            socket.emit('join-expert', responseObj);
            await pg.disconnect();
        }
    })
}

const getChatting = (socket)=>{
    socket.on('getChatting', async (getChattingObj)=>{
        const {room_id, participant_id, page_count} = getChattingObj;
        const pagePerRow = 5; // 페이지당 댓글 개수
        const pg = new postgres();
        const responseObj = {
            result:null,
            errmsg:null,
        }
        try{
            await pg.connect();

            await pg.queryUpdate(`BEGIN;`);
            const result = await pg.queryExecute(
                `
                SELECT chatting_index, sender_index, message, C.created_at, is_alarm, 
                (SELECT nickname FROM knock.users WHERE user_index = R.user_index)
                FROM knock.chatting AS C
                JOIN knock.room AS R ON C.room_index = R.room_index
                WHERE C.room_index = $1
                ORDER BY chatting_index ASC
                `
            , [room_id]);
            //OFFSET ${pagePerRow * (page_count - 1)} LIMIT ${pagePerRow * page_count};

            if(result.rowCount != 0){
                const lastChatId = result.rows[result.rowCount - 1].chatting_index;

                // 읽지 않은 메시지 수를 0으로 set, last read chat update
                await pg.queryUpdate(  
                    `
                    UPDATE knock.participant
                    SET not_read_chat = 0, last_read_chat_id = $3
                    WHERE participant_index = $1 AND room_index = $2;
                    `
                , [participant_id, room_id, lastChatId]);
            }

            responseObj.result = result.rows;
            responseObj.errmsg = 'no error';
        }
        catch(err){
            responseObj.errmsg = err;
            await pg.queryUpdate(`ROLLBACK`);
            console.log(err);
        }
        finally{
            socket.emit('getChatting', responseObj);
            await pg.queryUpdate(`END;`);
            await pg.disconnect();
        }
    })
}

// joinRoom에서 처음으로 채팅을 불러오고, 추가로 채팅을 더 불러오는 on함수 필요.

const message = (socket) => {
    socket.on('message', async(messageObj) => {
        // participant_id는 다른 room에 같은 userId를 구분하기 위함
        const {room_id, sender_index, message, participant_id} = messageObj;

        const pg = new postgres();
        const messageResponse = {
            result : [{
                message_id: null,
                room_id,
                sender_index,
                message,
                created_at: null
            }],
            errmsg : null,
        }
        const responseObj = {
            result:null,
            errmsg:null,
        }
        try{
            await pg.connect();
            await pg.queryUpdate(`BEGIN;`);

            // chatting table에 보낸 채팅 기록
            const savedMessage = await pg.queryExecute(
                `
                INSERT INTO knock.chatting (room_index, sender_index, message, created_at)
                VALUES ($1, $2, $3, NOW() + '9 hour'::interval)
                RETURNING chatting_index, created_at;
                `,
                [room_id, sender_index, message]
            );
            
            // room의 마지막 채팅을 업데이트
            await pg.queryUpdate(
                `
                UPDATE knock.room SET last_chat_index = $1
                WHERE room_index = $2;
                `,
                [savedMessage.rows[0].chatting_index, room_id]
            )
        
            await pg.queryUpdate(   // 수신자의 읽지 않은 메시지 수를 1 증가
            // 수신자는 같은 방에있는 user가 아닌 다른 participant로 찾음
                `
                UPDATE knock.participant 
                SET not_read_chat = not_read_chat + 1
                WHERE room_index = $1 AND participant_index != $2;
                `,
                [room_id, participant_id]
            );
            await pg.queryUpdate(   // 송신자의 읽지 않은 메시지 수를 0으로 set
                `
                UPDATE knock.participant 
                SET not_read_chat = 0
                WHERE room_index = $1 AND participant_index = $2;
                `,
                [room_id, participant_id]
            )

            messageResponse.result[0].message_id = savedMessage.rows[0].chatting_index;
            messageResponse.result[0].created_at = savedMessage.rows[0].created_at;
            
            socket.to(room_id).emit('message', messageResponse);
            socket.emit('message', messageResponse);

            // -- 위 두 코드를 아래 하나의 코드로 사용할 수 있는 것으로 보임
            // socket.nsp.to(room_id).emit('message', messageResponse);
        }
        catch(err){
            await pg.queryUpdate(`ROLLBACK;`);

            if(err instanceof PostgreConnectionError)
                console.log("연결에러 : " + err);
            else if(err instanceof SqlSyntaxError)
                console.log("sql 에러 : " + err);
            else
                console.log(err);

            responseObj.errmsg = "전송에 실패하였습니다.";
            socket.emit('message-failed', responseObj);
        }
        finally{
            await pg.queryUpdate(`END;`);
            await pg.disconnect();
        }
    })
}

const readChat = (socket) => {
    socket.on('readChat', async(req) => {
        const {user_id, room_id} = req;
        const pg = null;
        try{
            pg = new postgres();
            pg.connect();

            pg.queryUpdate(  // 읽지 않은 메시지 수를 0으로 set합니다.
                `
                UPDATE knock.participant
                SET not_read_chat = 0
                WHERE user_index =$1 AND room_index =$2;
                `,
                [user_id, room_id]
            )
            
        }
        catch(err){
            if(err instanceof PostgreConnectionError)
                console.log("연결에러 : " + err);

            else if(err instanceof SqlSyntaxError)
                console.log("sql 에러 : " + err);
            
            else
                console.log(err);
        }
        finally{
            pg.disconnect();
        }
    })
}

const debug = (socket, io) =>{
    socket.on('debug', async(debugObj)=>{
        const {room_id} = debugObj;

        console.log(io.sockets.adapter.rooms);
        const responseObj = {
            value : socket.rooms,
            hello: 1,
        }
        socket.emit('debug',responseObj);
    });
}