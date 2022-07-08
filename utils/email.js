const nodemailer = require('nodemailer');
const {SendMailError} = require('../errors/error');
module.exports.sendMail = async(message, receiverMailAddress)=>{
    const transporter = nodemailer.createTransport({
        service : 'naver',
        host : 'smtp.naver.com',
        port : 465,
        secure : false,
        auth :{
            user: process.env.MAILER_USER,
            pass : process.env.MAILER_PASSWORD
        }
    });

    try{
        await transporter.sendMail({
            from : process.env.MAILER_EMAIL,
            to : receiverMailAddress,
            subject : `knock 임시 비밀번호입니다.`,
            text : 
            `
            다음 비밀번호로 로그인 하세요.\n
            ${message}
            `
        })
    }
    catch(err){
        throw new SendMailError();
    }
}