const postgres = require('../database/pg');
const parameter = require('../utils/parameter');
const path = require('path');
const fs = require('fs');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError} = require('../errors/error');

module.exports.getBannerList = async(req,res) =>{

    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT banner_index AS banner_id, title_img_url 
            FROM knock.banner
            WHERE is_opened = true
            ORDER BY banner_order;
            `
        ,[])

        return res.status(200).send({
            bannerList : result.rows
        })
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.getBannerDetail = async(req,res)=>{

    const bannerId = req.params.bannerid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(bannerId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT title_img_url, content_img_url FROM knock.banner WHERE banner_index= $1;
            `
        ,[bannerId])

        return res.status(200).send(result.rows[0])
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        
        if(err instanceof NullParameterError)
            return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.getBannerimage = async(req,res) =>{
    const fileName = req.params.fileName;

    try{
        const image = await fs.promises.readFile(path.join(__dirname, `../images/banners/${fileName}`))
        res.writeHead(200, {'Content-type' : 'image/jpeg'});
        res.write(image);
        res.end();
    }
    catch(err){
        console.log(err);
        return res.status(500).send();
    }
}