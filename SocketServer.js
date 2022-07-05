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
        const {room_id, send_user_id, message, participant_id} = messageObj;
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
        
            await pg.queryUpdate(   // 수신자의 읽지 않은 메시지 수를 1 증가시킵니다.
                `
                UPDATE knock.participant 
                SET not_read_chat = not_read_chat + 1
                WHERE user_index = $1 AND room_index = $2
                `,
                [participant_id, room_id]
            );                                    
            await pg.queryUpdate(   // 송신자의 읽지 않은 메시지 수를 0으로 set합니다.
                `                   
                UPDATE knock.participant 
                SET not_read_chat = 0
                WHERE user_index = $1 AND room_index = $2
                `,
                [send_user_id, room_id]
            )
            io.to(room_id).emit('message', messageResponse);
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
