const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "node_modules", "pdf-to-printer", "dist", "SumatraPDF-3.4.6-32.exe");
const targetDir = path.join(projectRoot, "bin");
const target = path.join(targetDir, "SumatraPDF.exe");

if (!fs.existsSync(source)) {
  console.error("Arquivo fonte do SumatraPDF nao encontrado:", source);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.copyFileSync(source, target);
console.log("SumatraPDF preparado em:", target);
