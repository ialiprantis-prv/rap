/** Authentication failure surfaced to the client as a generic 401. */
export class AuthError extends Error {
  readonly statusCode = 401;
  readonly code: string;
  constructor(message = 'Unauthorized', code = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Generic bad-login / wrong-password result (no user enumeration). */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid credentials', 'InvalidCredentials');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Thrown at startup when no users exist and no admin-seed env is set.
 * Fail closed: the service must refuse to start rather than run open.
 */
export class AuthBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthBootstrapError';
  }
}
