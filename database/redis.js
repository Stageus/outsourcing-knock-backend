const {createClient} = require('redis');
const {RedisConnectionError, RedisError} = require('../errors/error');

module.exports = class Redis{
    Redis(){
        this.client = null;
    }
    async connect(){
        try{
            this.client = createClient();
            await this.client.connect();
        }
        catch(err){
            console.log(err);
            throw new RedisConnectionError(err);
        }
    }

    async getProductSequence(){
        try{
            let productSequence = await this.client.get('productSequence');
            if(productSequence === null){
                await this.client.set('productSequence', 1);
                productSequence = 1;
            }
            else
                await this.client.set('productSequence', Number(productSequence)+1);
            return productSequence;
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async disconnect(){
        try{
            await this.client.quit();
        }
        catch(err){
            console.log(err);
        }
    }

    async delete(key){
        try{
            await this.client.del(key);
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async getTTL(key){
        try{
            return await this.client.ttl(key);
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async setPrice(productNumber, price){
        try{
            await this.client.set(productNumber,price);
        }
        catch(err){
            throw new RedisError(err);
        }
    }
    async getPrice(productNumber){
        try{
            return await this.client.get(productNumber);
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async setCertifiedNumber(phone, certifiedNumber){
        try{
            await this.client.set(phone, certifiedNumber);
            await this.client.expire(phone, 60 * 3); // 인증시간 3m
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async getCertifiedNumber(phone){
        try{
            return await this.client.get(phone);
        }
        catch(err){
            throw new RedisError(err);
        }
    }
}