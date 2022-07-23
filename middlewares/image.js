const multer = require('multer');
const path = require('path');
const imageUtil = require('../utils/image');
const postgres = require('../database/pg');
const parameter = require('../utils/parameter');
const util = require('util');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError} = require('../errors/error');


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

module.exports.uploadBannerImage = async(req,res) =>{
    const storage = multer.diskStorage({
        destination: (req, files, cb) => {
          cb(null, path.join(__dirname, '../images/banners')) // cb 콜백함수를 통해 전송된 파일 저장 디렉토리 설정
        },
        filename: async(req, files, cb) =>{
            const fileName = await imageUtil.getFileName()+'.' + files.mimetype.split('/')[1];
          cb(null, fileName) // cb 콜백함수를 통해 전송된 파일 이름 설정
        }
      })

    const Multer = multer({
        storage : storage,
        limits : 5 * 1024 * 1024,   
        fileFilter : fileFilter
    })
    const pg = new postgres();
    
    try{
        const upload = util.promisify(Multer.fields([{ name: 'bannerTitle', maxCount: 12 }, { name: 'content', maxCount: 12 }]));
        await upload(req,res);
            
        const {bannerOrder, isOpened, title} = req.body;
        const titlePath = req.files['title'][0].filename;
        const contentPath = req.files['content'][0].filename;

        
        await imageUtil.resizingImage(req.files['title'][0].path, 'banners', req.files['title'][0].filename);
        await imageUtil.resizingImage(req.files['content'][0].path, 'banners', req.files['content'][0].filename);

        await parameter.nullCheck(bannerOrder, isOpened, title, titlePath, contentPath);

        await pg.connect();
        await pg.queryUpdate(`BEGIN;`,[]);
        await pg.queryUpdate(
            `
            UPDATE knock.banner SET banner_order = banner_order + 1 WHERE banner_order >= $1;
            `
        ,[bannerOrder]);

        await pg.queryUpdate(
            `
            INSERT INTO knock.banner (title, title_img_url, content_img_url, banner_order, is_opened)
            VALUES ($1, $2, $3, $4, $5);
            `
            ,[title, titlePath, contentPath, bannerOrder, isOpened])

        await pg.queryUpdate('COMMIT;',[]);

        return res.status(200).send();

    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError){
            await pg.queryUpdate('ROLLBACK',[]);
            return res.status(500).send();
        }

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }   
}

