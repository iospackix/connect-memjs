/*!
 * connect-memcached
 * Copyright(c) 2012 Michał Thoma <michal@balor.pl>
 * MIT Licensed
 */

/**
 * Library version.
 */

exports.version = '0.0.8';


/**
 * Module dependencies.
 */

var debug = require('debug')('connect-memjs');
var memjs = require('memjs');

/**
 * One day in seconds.
 */

var oneDay = 86400;


/**
 * Return the `MemcachedStore` extending `connect`'s session Store.
 *
 * @param {object} connect
 * @return {Function}
 * @api public
 */

module.exports = function(session){

  /**
   * Connect's Store.
   */

  var Store = session.Store;

  /**
   * Initialize MemcachedStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function MemcachedStore(options) {
    options = options || {};
    Store.call(this, options);

    if (!options.client) {
      var servers = null;
      if (options.servers) {
        servers = options.servers.join(',');
      }

      this.debug = options.debug || false;

      if (options.prefix) {
          this.prefix = options.prefix;
      }
      
      if (options.touchAfter) {
        this.touchAfter = options.touchAfter;
        delete options['touchAfter'];
      }

      options.client = memjs.Client.create(servers, options);
      
      if (this.debug) {
          debug("memjs initialized for servers: " + servers);
      }
    }

    this.client = options.client;

    //this.client.on("issue", function(issue) {
    //    log("memjs::Issue @ " + issue.server + ": " +
    //        issue.messages + ", " + issue.retries  + " attempts left");
    //});
  };

  /**
   * Inherit from `Store`.
   */

  MemcachedStore.prototype.__proto__ = Store.prototype;

  /**
   * A string prefixed to every memcached key, in case you want to share servers
   * with something generating its own keys.
   * @api private
   */
  MemcachedStore.prototype.prefix = '';
  MemcachedStore.prototype.touchAfter = 0;

   /**
   * Translates the given `sid` into a memcached key, optionally with prefix.
   *
   * @param {String} sid
   * @api private
   */
  
  
  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  MemcachedStore.prototype.touch = function(sid, sess, fn) {
    const touchAfter = this.touchAfter * 1000;
    const lastModified = sess.lastModified ? new Date (sess.lastModified).getTime() : 0;
    const currentDate = new Date();

    // If the given options has a touchAfter property, check if the
    // current timestamp - lastModified timestamp is bigger than
    // the specified, if it's not, don't touch the session
    if (touchAfter > 0 && lastModified > 0) {
      const timeElapsed = currentDate.getTime() - sess.lastModified;

      if (timeElapsed < touchAfter) {
        return fn();
      }
      this.set(sid, sess, fn);
    } else {
      return fn();
    }
    
  };
  
  MemcachedStore.prototype.getKey = function getKey(sid) {
    return this.prefix + sid;
  };

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  MemcachedStore.prototype.get = function(sid, fn) {
      if (this.debug) {
        var startTime = new Date().getTime();
      }
      sid = this.getKey(sid);

      var that = this;
      this.client.get(sid, function(err, data) {
          if (err) {
              console.log('Session GET failed:', err);
              return fn(err);
          }
          if (!data)
              return fn();

          try {
              data = JSON.parse(data);
          }
          catch (e) {
              console.log('parsing session data failed, setting null');
              data = null;
          }
          if (that.debug) {
              var totalTime = (new Date().getTime()) - startTime;
              console.log("Session GET took " + totalTime + 'ms');
          }
          fn(null, data);
      });
  };

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  MemcachedStore.prototype.set = function(sid, sess, fn) {
      sid = this.getKey(sid);
    
      if (this.touchAfter > 0) {
        sess.lastModified = new Date();
      }

      var maxAge = sess.cookie.maxAge
      var ttl = 'number' == typeof maxAge ? maxAge / 1000 | 0 : oneDay
      var sess = JSON.stringify(sess);

      this.client.set(sid, sess, { expires: ttl }, function() {
          fn && fn.apply(this, arguments);
      });
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  MemcachedStore.prototype.destroy = function(sid, fn) {
        sid = this.getKey(sid);
        this.emit('destroy');
        this.client.delete(sid, fn);
  };

  /**
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */

  MemcachedStore.prototype.length = function(fn) {
        // memjs doesn't have this function
        return fn(null);
  };

  /**
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */

  MemcachedStore.prototype.clear = function(fn) {
        this.client.flush(fn);
  };

  return MemcachedStore;
};
