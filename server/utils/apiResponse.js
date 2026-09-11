const { withId } = require('../config/prismaClient');

class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = withId(data);
  }
}

module.exports = ApiResponse;
