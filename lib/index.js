'use strict';

var path = require('path');
var resolve = require('resolve');
var pkgUp = require('pkg-up');
var targetPlugin = require('babel-plugin-module-resolver').default;
var resolvePath = require('babel-plugin-module-resolver').resolvePath;
var OptionManager = require('babel-core').OptionManager;

function getPlugins(file, target) {
  try {
    var manager = new OptionManager();
    var result = manager.init({
      babelrc: true,
      filename: file
    });

    return result.plugins.filter(function (plugin) {
      var plug = OptionManager.memoisedPlugins.find(function (item) {
        return item.plugin === plugin[0];
      });

      return plug && plug.container === target;
    });
  } catch (err) {
    // This error should only occur if something goes wrong with babel's
    // internals. Dump it to console so people know what's going on,
    // elsewise the error will simply be squelched in the calling code.
    console.error('[eslint-import-resolver-babel-module]', err);
    console.error('See: https://github.com/tleunen/eslint-import-resolver-babel-module/pull/34');
    return [];
  }
}

function stripWebpack(src) {
  var source = src;

  // strip loaders
  var finalBang = source.lastIndexOf('!');
  if (finalBang >= 0) {
    source = source.slice(finalBang + 1);
  }

  // strip resource query
  var finalQuestionMark = source.lastIndexOf('?');
  if (finalQuestionMark >= 0) {
    source = source.slice(0, finalQuestionMark);
  }

  return source;
}

exports.interfaceVersion = 2;

/**
 * Find the full path to 'source', given 'file' as a full reference path.
 *
 * resolveImport('./foo', '/Users/ben/bar.js') => '/Users/ben/foo.js'
 * @param  {string} source - the module to resolve; i.e './some-module'
 * @param  {string} file - the importing file's full path; i.e. '/usr/local/bin/file.js'
 * @param  {object} options - the resolver options
 * @return {object}
 */
exports.resolve = function (source, file, opts) {
  var options = opts || {};
  if (resolve.isCore(source)) return { found: true, path: null };

  var projectRootDir = path.dirname(pkgUp.sync(file));

  try {
    var instances = getPlugins(file, targetPlugin);

    var pluginOpts = instances.reduce(function (config, plugin) {
      return {
        cwd: plugin[1] && plugin[1].cwd ? plugin[1].cwd : config.cwd,
        root: config.root.concat(plugin[1] && plugin[1].root ? plugin[1].root : []),
        alias: Object.assign(config.alias, plugin[1] ? plugin[1].alias : {}),
        extensions: plugin[1] && plugin[1].extensions ? plugin[1].extensions : config.extensions
      };
    }, { root: [], alias: {}, cwd: options.projectRootDir || projectRootDir });

    var finalSource = stripWebpack(source);
    var src = resolvePath(finalSource, file, pluginOpts);

    var extensions = options.extensions || pluginOpts.extensions;

    return {
      found: true,
      path: resolve.sync(src || source, Object.assign({}, options, {
        extensions,
        basedir: path.dirname(file)
      }))
    };
  } catch (e) {
    return { found: false };
  }
};