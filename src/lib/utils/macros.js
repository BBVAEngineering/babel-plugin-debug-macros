const DEBUG = 'DEBUG';

import Builder from './builder';

export default class Macros {
  constructor(t, options) {
    this.localDebugBindings = [];
    this.importedDebugTools = false;
    this.envFlags = options.envFlags.flags;
    this.featureFlags = options.features;
    this.debugHelpers = options.externalizeHelpers.debug;
    this.isGlobals = true;

    this.builder = new Builder(t, options.externalizeHelpers);
  }

  /**
   * Injects the either the env-flags module with the debug binding or
   * adds the debug binding if missing from the env-flags module.
   */
  expand(path) {
    let debugBinding = path.scope.getBinding(DEBUG);
    let { builder } = this;

    if (this._hasDebugModule(debugBinding)) {
      this.builder.expandMacros(debugBinding.path.node.local);
      this._inlineEnvFlags(debugBinding.path.parentPath);
    } else {
      let debugIdentifier = path.scope.generateUidIdentifier(DEBUG);

      if (builder.expressions.length > 0) {
        this._injectDebug(path, debugIdentifier);
      }

      this.builder.expandMacros(debugIdentifier);
    }

    this._cleanImports(path);
  }

  inlineFeatureFlags(path) {
    for (let i = 0; i < this.featureFlags.length; i++) {
      let features = this.featureFlags[i];
      if (features.featuresImport === path.node.source.value) {
        let flagDeclarations = this.builder.flagConstants(path.node.specifiers, features.flags, path.node.source.value);
        path.replaceWithMultiple(flagDeclarations);
        break;
      }
    }
  }

  /**
   * Collects the import bindings for the debug tools.
   */
  collectDebugToolsSpecifiers(specifiers) {
    this.importedDebugTools = true;
    this._collectImportBindings(specifiers, this.localDebugBindings);
  }

  /**
   * Builds the expressions that the CallExpression will expand into.
   */
  build(path) {
    let expression = path.node.expression;
    let { builder, localDebugBindings } = this;
    if (builder.t.isCallExpression(expression) && localDebugBindings.indexOf(expression.callee.name) > -1) {
      let imported = path.scope.getBinding(expression.callee.name).path.node.imported.name;
      this.builder[`${imported}`](path);
    }
  }

  _collectImportBindings(specifiers, buffer) {
    specifiers.forEach((specifier) => {
      this.localDebugBindings.push(specifier.local.name);
    });
  }

  _injectDebug(path, name) {
    path.node.body.unshift(this.builder.debugFlag(name, this.envFlags.DEBUG));
  }

  _inlineEnvFlags(path) {
    let flagDeclarations = this.builder.flagConstants(path.node.specifiers, this.envFlags, path.node.source.value);
    path.replaceWithMultiple(flagDeclarations);
  }

  _hasDebugModule(debugBinding) {
    let fromModule = debugBinding && debugBinding.kind === 'module';
    let moduleName = fromModule && debugBinding.path.parent.source.value;
    return moduleName === '@ember/env-flags';
  }

  _cleanImports(path) {
    let { debugHelpers } = this;

    if (debugHelpers) {
      this.isGlobals = !!debugHelpers.global;
    }

    if (this.localDebugBindings.length > 0 && this.isGlobals) {
      let importDeclaration = path.scope.getBinding(this.localDebugBindings[0]).path.parentPath;

      // Note this nukes the entire ImportDeclaration so we simply can
      // just grab one of the bindings to remove.
      importDeclaration.remove();
    }
  }
}
