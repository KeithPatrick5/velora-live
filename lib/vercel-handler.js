let handlerPromise;

module.exports = async function veloraHandler(request, response) {
  handlerPromise ||= import("../server.mjs").then(module => module.requestHandler);
  const handler = await handlerPromise;
  return handler(request, response);
};
