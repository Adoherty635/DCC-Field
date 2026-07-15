// Express 4 does not await async route handlers, so a rejected promise
// becomes an unhandled rejection instead of a response — the request just
// hangs. Wrapping routes with this forwards the error to next() instead.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
