const sharp = require('sharp');
const {v4} = require('uuid');
const path = require('path');
const fs = require('fs');


module.exports.getFileName = async() =>{
    const token = v4().split('-');
    return token[2] + token[1] + token[0] + token[3] + token[4];
}


module.exports.resizingImage = async(oldPath, newPath, filename) =>{
    try{
        await sharp(oldPath)
            .resize(300,300)
            .withMetadata()
            .toBuffer((err, buffer)=>{
                if(err) console.log(err);
                else
                    fs.writeFile(oldPath, buffer, (err) => {
                        if(!err)
                            fs.rename(oldPath, path.join(__dirname,`../images/${newPath}/${filename}`), (err)=>{
                                console.log(err);
                        })
                    });
            })
    }
    catch(err){
        console.log(err);
    }
}