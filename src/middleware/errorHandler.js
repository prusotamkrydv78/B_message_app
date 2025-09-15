export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  if (process.env.NODE_ENV !== 'test') {
    // Basic error logging
    //console.error(`[Error] ${status} - ${message}`);
  }
  res.status(status).json({ message });
}
