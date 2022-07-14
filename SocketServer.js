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
    message(socket, io);
    readChat(socket);    
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
                INSERT INTO knock.room (user_index, expert_index, created_at) VALUES($1, $2, NOW())
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
            await pg.queryUpdate(`END;`)
            await pg.disconnect();
        }
    });
}

const disconnect = (socket) => {
    socket.on('disconnect', () => {
        // leave room 처리 및 database에 적용
    });
}

const getRoomList = (socket) => {
    socket.on('roomList', async(user_id)=>{
        // 유저가 속한 room 리스트 반환
        const pg = new postgres();
        try{
            await pg.connect();
            
            const result = await pg.queryExecute(
                `
                SELECT * FROM knock.room where user_index = $1 OR expert_index = $1;
                `
            , [user_id]);

            socket.emit('roomList', result.rows);
        }
        catch(err){
            console.log(err);
        }
        finally{
            await pg.disconnect();
        }
    })
}

const joinRoom = (socket) => {
    socket.on('join', async (joinObj) => {
        const {room_id, user_id} = joinObj;
        socket.join(room_id);

        const pg = new postgres();
        try{
            await pg.connect();

            const result = await pg.queryExecute(
                `
                SELECT participant_index, last_read_chat_id FROM knock.participant WHERE room_index = $1 AND user_index = $2 OR expert_index = $2;
                `
            , [room_id, user_id]);

            // TODO : rows의 개수 예외처리
            if(result.rowCount != 0){   
                const responseObj = {
                    participant_id : result.rows[0].participant_index,
                    last_read_chat_id : result.rows[0].last_read_chat_id,
                };
                socket.emit('join', responseObj);
            }
            else{
                console.log("err : rowCount is 0");
            }
        }
        catch(err){
            console.log(err);
        }
        finally{
            await pg.disconnect();
        }
        
        // 채팅 불러오기
        // join하면 room_id와 room에서 자신의 participant_index를 가져옴
    })
}

const getChatting = (socket)=>{
    socket.on('getChatting', async (getChattingObj)=>{
        const {room_id, user_id, participant_id, last_read_chat_id} = getChattingObj;

        const pg = new postgres();
        try{
            await pg.connect();

            await pg.queryUpdate(`BEGIN;`);
            const result = await pg.queryExecute(
                `
                SELECT * FROM knock.chatting 
                WHERE room_index = $1
                ORDER BY chatting_index ASC;
                `
            , [room_id]);

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

            socket.emit('getChatting', result.rows);
        }
        catch(err){
            await pg.queryUpdate(`ROLLBACK`);
            console.log(err);
        }
        finally{
            await pg.queryUpdate(`END;`);
            await pg.disconnect();
        }
    })
}

// joinRoom에서 처음으로 채팅을 불러오고, 추가로 채팅을 더 불러오는 on함수 필요.

const message = (socket, io) => {
    socket.on('message', async(messageObj) => {
        // participant_id는 다른 room에 같은 userId를 구분하기 위함
        const {room_id, send_user_id, message, participant_id} = messageObj;
        
        const pg = new postgres();
        try{
            await pg.connect();
            await pg.queryUpdate(`BEGIN;`);

            // chatting table에 보낸 채팅 기록
            const savedMessage = await pg.queryExecute(
                `
                INSERT INTO knock.chatting (room_index, send_user_index, message, created_at)
                VALUES ($1, $2, $3, NOW())
                RETURNING chatting_index, created_at;
                `,
                [room_id, send_user_id, message]
            );
            
            // room의 마지막 채팅을 업데이트
            await pg.queryUpdate(
                `
                UPDATE knock.room SET last_chat = $1
                WHERE room_index = $2;
                `,
                [message, room_id]
            )
            
            const messageResponse = {
                message_id: savedMessage.rows[0].chatting_index,
                room_id,
                send_user_id,
                message,
                createdAt: savedMessage.rows[0].created_at,
            }
        
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
            io.to(room_id).emit('message', messageResponse);
        }
        catch(err){
            await pg.queryUpdate(`ROLLBACK;`);
            if(err instanceof PostgreConnectionError)
                console.log("연결에러 : " + err);

            else if(err instanceof SqlSyntaxError)
                console.log("sql 에러 : " + err);
                
            else
                console.log(err);
        }
        finally{
            await pg.queryUpdate(`END;`);
            pg.disconnect();
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
