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
    disconnect(socket);
    joinRoom(socket);
    message(socket, io);
    readChat(socket);    
});


const disconnect = (socket) => {
    socket.on('disconnect', () => {

    });
}

const joinRoom = (socket) => {
    socket.on('join', (room_id) => {
        socket.join(room_id);
    })
}

const message = (socket, io) => {
    socket.on('message', async(messageObj) => {
        const {room_id, send_user_id, message} = messageObj;
        //TODO : orm에서 쿼리로 바꾸기
        try{
            const pg = new postgres();
            pg.connect();
            
            const savedMessage = await pg.queryExecute(
                `
                INSERT INTO knock.chatting (room_index, send_user_index, message)
                VALUES ($1, $2, $3)
                RETURNING chatting_index, created_at;
                `,
                [room_id, send_user_id, message]
            );
            /*
            await pg.queryUpdate(
                `
                UPDATE knock.room SET last_chat = $1
                WHERE room_idx = $2;
                `,
                [message, room_id]
            )*/

            console.log(savedMessage);
            
        /*
            const messageResponse = {
                message_id: savedMessage.rows[0].chatting_index,
                room_id,
                send_user_id,
                message,
                createdAt: savedMessage.rows[0].created_at,
            }
            const me = messageObj.send_user_id;
            const target = messageObj.participant_id;

            io.to(target).emit('message', messageResponse);
            io.to(me).emit('message', messageResponse);
            
            await Participant.increment(["not_read_chat"], { // 수신자의 읽지 않은 메시지 수를 1 증가시킵니다.
                where: {
                    user_id: messageObj.participant_id,
                    room_id
                }
            });
        
            await Participant.update({          // 송신자의 읽지 않은 메시지 수를 0으로 set하고
                not_read_chat: 0,               // 마지막으로 읽은 message_id를 현재 송신한 message_id로 set합니다.
                last_read_chat_id: savedMessage.id
            },{
                where:{
                    user_id: messageObj.send_user_id,
                    room_id
                }
            })  */
        }
        catch(err){
            if(err instanceof PostgreConnectionError)
                console.log("연결에러 : " + err);

            else if(err instanceof SqlSyntaxError)
                console.log("sql 에러 : " + err);
                
            else
                console.log(err);
        }
            
    })
}

const readChat = (socket) => {
    socket.on('readChat', async(req) => {
        const {user_id, room_id, last_read_chat_id} = req;
 
        await Participant.update({
            not_read_chat: 0,
            last_read_chat_id: last_read_chat_id
        },{
            where: {
                user_id,
                room_id
            }
        })
    })
}
