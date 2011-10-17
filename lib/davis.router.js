/*!
 * Davis - router
 * Copyright (C) 2011 Oliver Nightingale
 * MIT Licensed
 */

/**
 * A decorator that adds convinience methods to a Davis.App for easily creating instances
 * of Davis.Route and looking up routes for a particular request.
 *
 * Provides get, post put and delete method shortcuts for creating instances of Davis.Routes
 * with the corresponding method.  This allows simple REST styled routing for a client side
 * JavaScript application.
 *
 * ### Example
 *
 *     app.get('/foo/:id', function (req) {
 *       // get the foo with id = req.params['id']
 *     })
 *     
 *     app.post('/foo', function (req) {
 *       // create a new instance of foo with req.params
 *     })
 *     
 *     app.put('/foo/:id', function (req) {
 *       // update the instance of foo with id = req.params['id']
 *     })
 *     
 *     app.del('/foo/:id', function (req) {
 *       // delete the instance of foo with id = req.params['id']
 *     })
 *
 * As well as providing convinience methods for creating instances of Davis.Routes the router
 * also provides methods for creating special instances of routes called filters.  Before filters
 * run before any matching route is run, and after filters run after any matched route has run.
 * A before filter can return false to halt the running of any matched routes or other before filters.
 *
 * A filter can take an optional path to match on, or without a path will match every request.
 *
 * ### Example
 *
 *     app.before('/foo/:id', function (req) {
 *       // will only run before request matching '/foo/:id'
 *     })
 *     
 *     app.before(function (req) {
 *       // will run before all routes
 *     })
 *     
 *     app.after('/foo/:id', function (req) {
 *       // will only run after routes matching '/foo/:id'
 *     })
 *     
 *     app.after(function (req) {
 *       // will run after all routes
 *     })
 *
 * Another special kind of route, called state routes, are also generated using the router.  State routes
 * are for requests that will not change the current page location.  Instead the page location will remain
 * the same but the current state of the page has changed.  This allows for states which the server will not
 * be expected to know about and support.
 *
 * ### Example
 *
 *     app.state('/foo/:id', function (req) {
 *       // will run when the app transitions into the '/foo/:id' state.
 *     })
 *
 * Using the `trans` method an app can transition to these kind of states without changing the url location.
 */
Davis.router = (function () {

  /**
   * ## app.route
   * Low level method for adding routes to your application.
   *
   * If called with just a method will return a partially applied function that can create routes with
   * that method.  This is used internally to provide shortcuts for get, post, put, delete and state
   * routes.
   *
   * You normally want to use the higher level methods such as get and post, but this can be useful for extending
   * Davis to work with other kinds of requests.
   *
   * @param {String} method The method for this route.
   * @param {String} path The path for this route.
   * @param {Function} handler The handler for this route, will be called with the request that triggered the route.
   * @returns {Davis.Route} the route that has just been created and added to the route list.
   *
   * ### Example
   *
   *     app.route('get', '/foo', function (req) {
   *       // will run when a get request is made to '/foo'
   *     })
   *
   *     app.patch = app.route('patch') // will return a function that can be used to handle requests with method of patch.
   *     app.patch('/bar', function (req) {
   *       // will run when a patch request is made to '/bar'
   *     })
   */
  function route (method, path, handler) {
    if (arguments.length == 1) {
      return function (path, handler) {
        var route = new Davis.Route (method, path, handler)
        routeCollection.push(route)
        return route
      }
    } else {
      var route = new Davis.Route (method, path, handler)
      routeCollection.push(route)
      return route
    };
  }

  /**
   * ## app.get, app.post, app.put
   * Generating convinience methods for creating Davis.Routes.
   *
   * delete is a reserved word in javascript so use the `del` method to
   * creating a Davis.Route with a method of delete.
   *
   * @param {String} path The path for this route.
   * @param {Function} handler The handler for this route, will be called with the request that triggered the route.
   * @returns {Davis.Route} the route that has just been created and added to the route list.
   */
  var get  = route('get'),
      post = route('post'),
      put  = route('put'),
      del  = route('delete');

  /**
   * ## app.state
   * Adds a state route into the apps route collection.  These special kind of routes are not triggered
   * by clicking links or submitting forms, instead they are triggered manually by calling `trans`.
   *
   * Routes added using the state method act in the same way as other routes except that they generate
   * a route that is listening for requests that will not change the page location.
   *
   * @param {String} path The path for this route, this will never be seen in the url bar.
   * @param {Function} handler The handler for this route, will be called with the request that triggered the route
   *
   * ### Example
   *
   *     app.state('/foo/:id', function (req) {
   *       // will run when the app transitions into the '/foo/:id' state.
   *     })
   *
   */
  var state = route('state');

  /**
   * ## app.trans
   * Transitions the app into the state identified by the passed path parameter.  This allows the app to
   * enter states without changing the page path through a link click or form submit.  If there are handlers
   * registered for this state, added by the `state` method, they will be triggered.
   *
   * This method generates a request with a method of 'state', in all other ways this request is identical
   * to those that are generated when clicking links etc.
   *
   * States transitioned to using this method will not be able to be revisited directly with a page load as
   * there is no url that represents the state.
   *
   * An optional second parameter can be passed which will be available to any handlers in the requests
   * params object.
   *
   * @param {String} path The path that represents this state.  This will not be seen in the url bar.
   * @param {Object} data Any additional data that should be sent with the request as params.
   *
   * ### Example
   *
   *     app.trans('/foo/1')
   *     
   *     app.trans('/foo/1', {
   *       "bar": "baz"
   *     })
   *     
   */
  function trans (path, data) {
    if (data) {
      var fullPath = [path, decodeURIComponent(jQuery.param(data))].join('?')
    } else {
      var fullPath = path
    };

    var req = new Davis.Request({
      method: 'state',
      fullPath: fullPath,
      title: ''
    })

    Davis.location.assign(req)
  }

  /**
   * Generating convinience methods for creating filters using Davis.Routes and methods to
   * lookup filters.
   */
  function filter (filterName) {
    return function () {
      var method = /.+/;

      if (arguments.length == 1) {
        var path = /.+/;
        var handler = arguments[0];
      } else if (arguments.length == 2) {
        var path = arguments[0];
        var handler = arguments[1];
      };

      var route = new Davis.Route (method, path, handler)
      filterCollection[filterName].push(route);
      return route
    }
  }

  function lookupFilter (filterType) {
    return function (method, path) {
      return Davis.utils.filter(filterCollection[filterType], function (route) {
        return route.match(method, path)
      });
    }
  }

  var before = filter('before'),
      after  = filter('after'),
      lookupBeforeFilter = lookupFilter('before'),
      lookupAfterFilter  = lookupFilter('after');

  /**
   * collections of routes and filters
   * @private
   */
  var routeCollection = [];
  var filterCollection = {
    before: [],
    after: []
  };

  /**
   * ## app.lookupRoute
   * Looks for the first route that matches the method and path from a request.  Will only
   * find and return the first matched route.
   *
   * @param {String} method
   * @param {String} path
   * @returns {Davis.Route} route
   */
  function lookupRoute (method, path) {
    return Davis.utils.filter(routeCollection, function (route) {
      return route.match(method, path)
    })[0];
  };

  /**
   * ## app.removeAllRoutes
   * Removes all routes and filters.
   * @private
   */
  function removeAllRoutes () {
    routeCollection = []
    filterCollection = {
      before: [],
      after: []
    }
  };

  /**
   * exposing the public methods of the module
   * @private
   */
  return {
    lookupRoute: lookupRoute,
    route: route,
    get: get,
    post: post,
    put: put,
    del: del,
    before: before,
    after: after,
    state: state,
    trans: trans,
    lookupBeforeFilter: lookupBeforeFilter,
    lookupAfterFilter: lookupAfterFilter,
    removeAllRoutes: removeAllRoutes
  }
})()