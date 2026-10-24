/**
 * Centralized Error Handling Middleware for Express
 * Handles PostgreSQL database errors, JSON syntax errors, and custom application errors.
 * Ensures consistent JSON error responses without exposing internal stack traces or database passwords.
 */
function errorHandler(err, req, res, next) {
  // Log server-side for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  // Default response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. JSON parsing error (malformed request body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body. Please check your syntax.';
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // 2. PostgreSQL specific errors (pg error codes)
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        statusCode = 409;
        if (err.detail) {
          // Clean up postgres detail message e.g. "Key (phone)=(9876543210) already exists."
          message = `Duplicate field value: ${err.detail.replace(/Key \((.*?)\)=\((.*?)\)/, '$1 "$2"')}`;
        } else {
          message = 'A record with this unique value already exists.';
        }
        break;

      case '23503': // foreign_key_violation
        statusCode = 400;
        if (err.detail) {
          message = `Referenced entity does not exist or cannot be removed: ${err.detail}`;
        } else {
          message = 'Foreign key constraint violation: referenced record does not exist or is currently in use.';
        }
        break;

      case '23514': // check_violation
        statusCode = 400;
        message = `Validation constraint failed: ${err.constraint || 'Check constraint violation'}.`;
        break;

      case '22P02': // invalid_text_representation (e.g. text passed where integer was expected in ID)
        statusCode = 400;
        message = 'Invalid data type provided in request parameters or body (e.g. ID must be an integer).';
        break;

      case 'ECONNREFUSED':
      case '28P01': // invalid_password
      case '3D000': // database does not exist
        statusCode = 500;
        message = 'Database connection error. Please verify PostgreSQL service and credentials.';
        break;

      default:
        // Other SQL errors
        if (process.env.NODE_ENV !== 'production' && err.detail) {
          message = `Database Error: ${err.message}`;
        } else {
          message = 'A database error occurred while processing your request.';
        }
        break;
    }
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;

