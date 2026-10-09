// Express 4 doesn't catch a rejected promise from an async route handler —
// it just hangs the request. Every route became async with the move to
// pg's promise-based client, so wrap each one to forward rejections to the
// error-handling middleware in server.js instead of leaving the client
// waiting forever.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
