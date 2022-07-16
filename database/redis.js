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

    async getProductNumber(){
        try{
            let productNumber = await this.client.get('productNumber');
            if(productNumber === null){
                await this.client.set('productNumber', 1);
                productNumber = 1;
            }
            else
                await this.client.set('productNumber', Number(productNumber)+1);
            
            return productNumber;
        }
        catch(err){
            throw new RedisError(err);
        }
    }

    async disconnect(){
        try{
            await this.client.disconnect();
        }
        catch(err){
            console.log(err);
        }
    }
}