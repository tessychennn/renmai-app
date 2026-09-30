/** 登入已失效（token 過期或帳號被停用），需要使用者重新登入 */
export class AuthRequiredError extends Error {
  constructor(message = '需要重新登入') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}
