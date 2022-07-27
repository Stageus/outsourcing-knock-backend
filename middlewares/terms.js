const postgres = require('../database/pg');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError} = require('../errors/error');
const parameter = require('../utils/parameter');

module.exports.getTerms = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT terms_of_service_index AS terms_id, title, contents, is_activated
            FROM knock.terms_of_service
            WHERE is_activated = true
            ORDER BY terms_of_service_index;
            `
        ,[])

        return res.status(200).send({termsList : result.rows});
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.agreeTerms = async(req,res) =>{
    const email = req.body.email;
    const termsIdList = req.body.termsIdList;
    const pg = new postgres();


    try{
        await parameter.nullCheck(email, termsIdList);
        await pg.connect();

        /* termsIdList에 들어있는 element수 만큼 동적으로 쿼리를 구성한다. */
        let values = '';
        let cnt = 0;
        const parameterArray = [];
        termsIdList.forEach((elem)=>{
            parameterArray.push(elem);
            parameterArray.push(email);
            values += '($'+ ++cnt +', (SELECT user_index FROM knock.users WHERE id = $'+ ++cnt +'))'
            if(cnt != termsIdList.length*2)
                values += ',';
        })

        await pg.queryUpdate(
            `
            INSERT INTO knock.agree_terms_of_service (terms_of_service_index, user_index)
            VALUES ${values};
            `
        ,parameterArray);

        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }

}