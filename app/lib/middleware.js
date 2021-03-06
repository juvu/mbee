/**
 * @classification UNCLASSIFIED
 *
 * @module lib.middleware
 *
 * @copyright Copyright (C) 2018, Lockheed Martin Corporation
 *
 * @license MIT
 *
 * @owner Phillip Lee
 *
 * @author Jake Ursetta
 * @author Austin Bieber
 * @author Connor Doyle
 *
 * @description This file defines middleware functions which can be used by
 * express to perform actions during requests.
 */

// Node modules
const path = require('path');
const fs = require('fs');

// MBEE modules
const utils = M.require('lib.utils');
const logger = M.require('lib.logger');

/**
 * @description Log the route and method requested by a user.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to express authentication flow.
 */
module.exports.logRoute = function logRoute(req, res, next) {
  // Set username to anonymous if req.user is not defined
  const username = (req.user) ? (req.user._id || req.user.username) : 'anonymous';
  // Log the method, url, and username for the request
  const message = `${req.method} "${req.originalUrl}" requested by ${username}`;
  M.log.info(message);
  next();
};

/**
 * @description Log the route and method requested by a user to a separate security log
 * file for security-sensitive API endpoints.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to to trigger the next middleware.
 */
module.exports.logSecurityRoute = function logRoute(req, res, next) {
  // Set username to anonymous if req.user is not defined
  const username = (req.user) ? (req.user._id || req.user.username) : 'anonymous';
  // Log the method, url, and username for the request
  const message = `${req.method} "${req.originalUrl}" requested by ${username}`;
  // Add it to the security log
  fs.appendFileSync(path.join('logs', M.config.log.security_file), `${message}\n`);
  next();
};

/**
 * @description Logs the response to an HTTP request and calls the next middleware in the line.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to to trigger the next middleware.
 */
module.exports.logResponse = function logResponse(req, res, next) {
  logger.logResponse(req, res);
  next();
};

/**
 * @description Logs the response to an HTTP request to a separate security log file for
 * security-sensitive API endpoints and then calls the next middleware in the line.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to to trigger the next middleware.
 */
module.exports.logSecurityResponse = function logSecurityResponse(req, res, next) {
  logger.logSecurityResponse(req, res);
  next();
};

/**
 * @description Log the IP address where the request originated from.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to express authentication flow.
 */
module.exports.logIP = function logIP(req, res, next) {
  let ip = req.ip;
  // If IP is ::1, set it equal to 127.0.0.1
  if (req.ip === '::1') {
    ip = '127.0.0.1';
  }
  // If IP starts with ::ffff:, remove the ::ffff:
  else if (req.ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  // Log the method, url, and ip address for the request
  M.log.verbose(`${req.method} "${req.originalUrl}" requested from ${ip}`);
  next();
};

/**
 * @description Disables specific user api methods using the configuration
 * server.api.userAPI.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to express authentication flow.
 */
// eslint-disable-next-line consistent-return
module.exports.disableUserAPI = function disableUserAPI(req, res, next) {
  // Check if the request method is disabled
  if (M.config.server.api.userAPI[req.method.toLowerCase()] === false) {
    // Create error message '<method> <url> is disabled'
    const message = `${req.method} ${req.originalUrl} is disabled.`;
    // Create custom error 403 Forbidden
    const error = new M.OperationError(message, 'error');
    // Return error to user
    return res.status(403).send(error.message);
  }
  next();
};

/**
 * @description Disables the user patchPassword API endpoint.
 *
 * @param {object} req - Request object from express.
 * @param {object} res - Response object from express.
 * @param {Function} next - Callback to express authentication flow.
 */
// eslint-disable-next-line consistent-return
module.exports.disableUserPatchPassword = function disableUserPatchPassword(req, res, next) {
  // Check if the value in the config is explicitly set to false
  if (M.config.server.api.userAPI.patchPassword === false) {
    // Create error message 'PATCH <url> is disabled'
    const message = `PATCH ${req.originalUrl} is disabled.`;
    // Create custom error 403 Forbidden
    const error = new M.OperationError(message, 'error');
    // Return error to user
    return res.status(403).send(error.message);
  }
  next();
};

/**
 * @description Defines the plugin middleware function to be used before API controller
 * functions. Synchronously iterates through every plugin function that was registered to
 * this endpoint upon startup of the server.
 *
 * @param {string} endpoint - The name of the API Controller function.
 * @returns {Function} The function used in API routing that runs every plugin function
 * registered to the endpoint of interest.
 */
module.exports.pluginPre = function pluginPre(endpoint) {
  if (M.config.server.plugins.enabled) {
    // eslint-disable-next-line global-require
    const { pluginFunctions } = require(path.join(M.root, 'plugins', 'routes.js'));

    return async function(req, res, next) {
      for (let i = 0; i < pluginFunctions[endpoint].pre.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await pluginFunctions[endpoint].pre[i](req, res);
      }
      next();
    };
  }
  else {
    return function(req, res, next) {
      next();
    };
  }
};

/**
 * @description Defines the plugin middleware function to be used after API controller
 * functions. Synchronously iterates through every plugin function that was registered to
 * this endpoint upon startup of the server.
 *
 * @param {string} endpoint - The name of the API Controller function.
 * @returns {Function} The function used in API routing that runs every plugin function
 * registered to the endpoint of interest.
 */
module.exports.pluginPost = function pluginPost(endpoint) {
  if (M.config.server.plugins.enabled) {
    // eslint-disable-next-line global-require
    const { pluginFunctions } = require(path.join(M.root, 'plugins', 'routes.js'));

    return async function(req, res, next) {
      // If the response has already been sent, return
      if (res.statusCode) {
        next();
        return;
      }
      // Otherwise, run the plugin functions
      for (let i = 0; i < pluginFunctions[endpoint].post.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await pluginFunctions[endpoint].post[i](req, res);
      }
      next();
    };
  }
  else {
    return function(req, res, next) {
      next();
    };
  }
};

/**
 * @description Parses information from the locals field of the response object and then
 * calls the returnResponse function to send the response. Necessary for information to
 * be passed through multiple middleware functions.
 *
 * @param {object} req - Request express object.
 * @param {object} res - Response express object.
 *
 * @returns {object} Returns the response.
 */
module.exports.respond = function respond(req, res) {
  const message = res.locals.message;

  // If the response hasn't been formatted already, format it
  if (!(res.locals && res.locals.responseFormatted)) {
    const statusCode = res.locals.statusCode ? res.locals.statusCode : 200;
    const contentType = res.locals.contentType ? res.locals.contentType : 'application/json';

    utils.formatResponse(req, res, message, statusCode, null, contentType);
  }

  // Send the response
  res.send(message);

  return res;
};
