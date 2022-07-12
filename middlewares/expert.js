const postgres = require('../database/pg');
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError} = require('../errors/error');


//추천 전문가 리스트 가져오기 (3명)
module.exports.getRecommendedExpertsList = async(req,res) =>{
    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index AS expert_id, name, introduction_contents AS introduction, profile_img_url,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = expert.expert_index) AS review_count,
            (SELECT expert_type AS type FROM knock.have_expert_type INNER JOIN knock.expert_type ON have_expert_type.expert_type_index = expert_type.expert_type_index WHERE have_expert_type.expert_index = expert.expert_index)
            FROM knock.expert ORDER BY RANDOM() LIMIT 3;
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

module.exports.getExpertsList = async(req,res) =>{
    const pg = new postgres();
    const firstCategory = req.params.firstcategory;
    const secondCategory = req.params.secondcategory;
    const thirdCategory = req.params.thirdcategory;
    const pageCount = (req.params.pagecount-1) * 30;

    try{
        await parameter.nullCheck(firstCategory, secondCategory, thirdCategory, pageCount);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index AS expert_id, name, introduction_contents AS introduction, profile_img_url,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = expert.expert_index) AS review_count,
            (SELECT expert_type AS type FROM knock.have_expert_type INNER JOIN knock.expert_type ON have_expert_type.expert_type_index = expert_type.expert_type_index WHERE have_expert_type.expert_index = expert.expert_index),
            (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index WHERE expert_counseling_type.expert_index = expert.expert_index) AS type
            FROM knock.expert 
            WHERE expert_index IN (SELECT expert_index FROM knock.counseling_method_1st INNER JOIN knock.expert_counseling_method_1st ON expert_counseling_method_1st.counseling_method_1st_index = counseling_method_1st.counseling_method_1st_index WHERE counseling_method = $1)
            AND expert_index IN (SELECT expert_index FROM knock.counseling_method_2nd INNER JOIN knock.expert_counseling_method_2nd ON expert_counseling_method_2nd.counseling_method_2nd_index = counseling_method_2nd.counseling_method_2nd_index WHERE counseling_method = $2)
            AND expert_index IN (SELECT expert_index FROM knock.counseling_method_3rd INNER JOIN knock.expert_counseling_method_3rd ON expert_counseling_method_3rd.counseling_method_3rd_index = counseling_method_3rd.counseling_method_3rd_index WHERE counseling_method = $3)
            LIMIT 30 OFFSET $4
            `
        ,[firstCategory, secondCategory, thirdCategory, pageCount])

        return res.status(200).send({
            bannerList : result.rows
        })
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



module.exports.getExpertDetail = async(req, res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert.expert_index, profile_img_url, name, 
            (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON have_expert_type.expert_index= $1 AND expert_type.expert_type_index = have_expert_type.expert_type_index),
            (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON expert_counseling_type.expert_index = $1 AND counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index) AS counseling_type,
            (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = $1) AS review_count, introduction_title, introduction_contents, (SELECT array_agg(counseling_method) FROM knock.counseling_method_2nd INNER JOIN knock.expert_counseling_method_2nd ON expert_counseling_method_2nd.expert_index = $1 AND expert_counseling_method_2nd.counseling_method_2nd_index = counseling_method_2nd.counseling_method_2nd_index) AS counseling_type, qualification, career, education, monday, tuesday, wednesday, thursday, friday, saturday, sunday  FROM knock.expert INNER JOIN knock.available_counseling_time ON expert.expert_index= $1 AND expert.expert_index = available_counseling_time.expert_index;
            `
        ,[expertId])

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

//TODO 결제 테이블 완성되면 쿼리 짜기. 지금은 상담방식을 가져올 수 없음
module.exports.getBestReview = async(req,res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, user_index AS user_id, 
            `
        [expertId]);
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

//TODO 결제 테이블 완성되면 쿼리 짜기
module.exports.getReviewList = async(req,res) =>{
    const pg = new postgres();
    const expertId = req.params.expertid;

    try{
        await parameter.nullCheck(expertId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            `
        [expertId]);
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