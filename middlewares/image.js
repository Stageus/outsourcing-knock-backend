const multer = require('multer');
const path = require('path');
const imageUtil = require('../utils/image');


const fileFilter = (req, files, callback) =>{
    const typeArray = files.mimetype.split('/');
    const fileType = typeArray[1]; // 이미지 확장자 추출
    //이미지 확장자 구분 검사
    if(fileType == 'jpg' || fileType == 'jpeg' || fileType == 'png'){
        callback(null, true)
    }else {
        callback(new Error('이미지 파일만 업로드해주세요.'))
    }
}
module.exports.uploadImage = (req,res) =>{
    try{
        multer({
            dest : path.join(__dirname, '../images/banners'),
            limits : 5 * 1024 * 1024,
            fileFilter : fileFilter
        }).array('image')(req,res, (err)=>{
            console.log(req.files.path);
            //imageUtil.resizingImage(req.files.buffer);

            if(err){
                console.log(err);
                return res.status(400).send();
            }
            else{

                return res.status(200).send();
            }
        })
    }
    catch(err){
        if(err)
            return res.status(400).send();
    }
    
}
