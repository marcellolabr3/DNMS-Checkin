const fs = require("fs");
const path = require("path");
const Module = require("module");

function loadSqlite3() {
  if (!process.pkg) {
    return require("sqlite3");
  }

  const nativeBindingPath = findPortableSqliteBinding();
  const bindingModulePath = require.resolve("sqlite3/lib/sqlite3-binding.js");
  const bindingModule = new Module(bindingModulePath);
  bindingModule.filename = bindingModulePath;
  bindingModule.loaded = true;
  bindingModule.exports = require(nativeBindingPath);
  require.cache[bindingModulePath] = bindingModule;
  return require("sqlite3");
}

function findPortableSqliteBinding() {
  const baseDir = path.dirname(process.execPath);
  const candidates = [
    path.join(baseDir, "native", "sqlite3", "node_sqlite3.node"),
    path.join(baseDir, "node_sqlite3.node"),
    path.join(process.cwd(), "native", "sqlite3", "node_sqlite3.node"),
    path.join(process.cwd(), "node_sqlite3.node")
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return found;
  }
  throw new Error(
    `Binding nativo do SQLite nao encontrado. Esperado em: ${candidates.join("; ")}`
  );
}

module.exports = {
  loadSqlite3
};
