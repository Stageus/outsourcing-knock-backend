class BadRequestError extends Error {
  BadRequest() {
    this.message = "잘못된 요청입니다.";
    this.name = "BadRequestError";
    this.stack = `${this.message}\n${new Error().stack}`;
  }
}

class UnauthorizedError extends Error {
  Unauthorized() {
    this.message = "허가받지 않은 사용자입니다.";
    this.name = "UnauthorizedError";
    this.stack = `${this.message}\n${new Error().stack}`;
  }
}

// DB related
class PostgreConnectionError extends Error {
  PostgreConnectionError(error) {
    this.message = error.message;
    this.name = error.name;
    this.stack = error.stack;
  }
}

class SqlSyntaxError extends Error {
    SqlSyntaxError(error) {
        this.message = error.message;
        this.name = error.name;
        this.stack = error.stack;
    }
}

class MongoConnectionError extends Error {
  PostgreConnectionError(error) {
    this.message = error.message;
    this.name = error.name;
    this.stack = error.stack;
  }
}

class MongoCreateError extends Error{
    MongoCreateError(error) {
        this.message = "Mongo class 초기화 중 오류가 발생하였습니다.";
        this.name = error.name;
        this.stack = error.stack;
    }
}

class MongoDeleteError extends Error{
    MongoCreateError(error) {
        this.message = error.message;
        this.name = error.name;
        this.stack = error.stack;
    }
}

// Token related
class TokenIssueError extends Error {
    TokenIssueError(error) {
        this.message = "토큰 발급에서 오류가 발생하였습니다.";
        this.name = error.name;
        this.stack = error.stack;
    }
}

class TokenExpiredError extends Error {
  TokenExpiredError(error) {
    this.message = "토큰이 만료되었습니다.";
    this.name = error.name;
    this.stack = error.stack;
  }
}

class NullParameterError extends Error{
    NullParameterError(){
        this.message = "정의되지 않은 요청값이 존재합니다.";
        this.name = 'NullParameterError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

class SendMailError extends Error{
    SendMailError(){
        this.message = "메일 송신 중 오류가 발생하였습니다.";
        this.name = 'SendMailError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

class CreatedHashedPaswordError extends Error{
    CreatedHashedPaswordError(err){
        this.message = "hash password 생성 중 오류가 발생하였습니다.";
        this.name = error.name;
        this.stack = error.stack;
    }
}

class RedisConnectionError extends Error{
    RedisConnectionError(err){
        this.message = "redis 연결에 실패하였습니다."
        this.name = error.name;
        this.stack = error.stack;
    }
}

class RedisError extends Error{
    RedisError(err){
        this.message = "redis get, set 사용 중 오류가 발생하였습니다."
        this.name = error.name;
        this.stack = error.stack;
    }
}

module.exports = {
  BadRequestError,
  UnauthorizedError,
  PostgreConnectionError,
  SqlSyntaxError,
  MongoConnectionError,
  MongoCreateError,
  MongoDeleteError,
  TokenIssueError,
  TokenExpiredError,
  NullParameterError,
  SendMailError,
  CreatedHashedPaswordError,
  RedisConnectionError,
  RedisError,
};
