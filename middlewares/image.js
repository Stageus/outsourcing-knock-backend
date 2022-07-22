const multer = require('multer');
const path = require('path');


const fileFilter = (req, file, callback) =>{

    const typeArray = file.mimetype.split('/');

    const fileType = typeArray[1]; // 이미지 확장자 추출
    
    //이미지 확장자 구분 검사
    if(fileType == 'jpg' || fileType == 'jpeg' || fileType == 'png'){
        callback(null, true)
    }else {
        return callback({message: "*.jpg, *.jpeg, *.png 파일만 업로드가 가능합니다."}, false)
    }
}


module.exports.uploadImage = async(req,res) =>{
    const upload = multer({
        dest : path.join(__dirname, '../images/banners'),
        limits : 5 * 1024 * 1024,
        filefilter : fileFilter
    }).single('file');


    upload(req,res, () =>{
        console.log(req.file);
    })

    return res.send("4321412");
}
