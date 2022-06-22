class BadRequestError extends Error{        
    BadRequest(){
        this.message = "잘못된 요청입니다.";
        this.name = 'BadRequestError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

class UnauthorizedError extends Error{
    Unauthorized(){
        this.message = "허가받지 않은 사용자입니다.";
        this.name = 'BadRequestError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

class PostgreConnectionError extends Error{
    PostgreConnectionError(error){
        this.message = error.message;
        this.name = error.name;
        this.stack = error.stack;
    }
}

class SqlSyntaxError extends Error{
    SqlSyntaxError(error){
        this.message = error.message;
        this.name = error.name;
        this.stack = error.stack;
    }
}





