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

/** Authenticated but under-privileged (or a denied/misconfigured route) -> 403. */
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code: string;
  constructor(code = 'Forbidden', message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
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
