// 서버 실행하는 코드
const express = require('express'); 
const app = express();
const path = require('path'); // 파일들의 경로를 쉽게 접근할 수 있게 해주는 라이브러리
const https= require('https');
const fs = require('fs'); // 파일을 임포트 할 때 씀
const dotenv = require('dotenv');
const cors = require('cors');
//const router = require('./routes/router.js');


dotenv.config({path : path.join(__dirname, './config/.env')});
const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['POST','GET', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions)); 

/*const SSL = {
    key: fs.readFileSync(path.join(__dirname, process.env.SSL_KEY)),
    cert: fs.readFileSync(path.join(__dirname, process.env.SSL_CERT)),
    ca: fs.readFileSync(path.join(__dirname, process.env.SSL_CA))
};*/

app.use(express.urlencoded({ extended: false }));
app.use(express.json());


/*app.get('*', (req,res, next)=>{
    const protocol = req.protocol; 
    if(protocol == 'https'){
        next();
    }
    else{
        const destination = "https://" + req.hostname + req.url; 
        res.redirect(destination);
    }
})*/

//app.use('/',router);
app.use((req,res)=>{
    res.status(404).send("잘못된 페이지 요청입니다.");
})
app.listen(4000, (req,res) =>{
    console.log(4000 + "포트로 서버 실행");
})

/*https.createServer(SSL, app).listen(process.env.SERVER_PORT, (req,res)=>{  //options에 ssl 키가 들어감
    console.log(Ports + "포트로 서버 실행");
})*/
