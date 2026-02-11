console.log("=== DIAGNOSTIC ELECTRON ===")
console.log("process.versions.electron:", process.versions.electron)
console.log("process.versions.node:", process.versions.node)
console.log("process.type:", process.type)
console.log("process.argv:", process.argv)
console.log("__dirname:", __dirname)

console.log("\n=== MODULE RESOLUTION ===")
try {
  const resolved = require.resolve("electron")
  console.log("require.resolve('electron'):", resolved)
} catch (e) {
  console.log("require.resolve ERROR:", e.message)
}

console.log("\n=== PROCESS BINDINGS ===")
console.log("process.electronBinding:", typeof process.electronBinding)
console.log("process._linkedBinding:", typeof process._linkedBinding)

const e = require("electron")
console.log("\ntypeof require('electron'):", typeof e)
console.log("value:", typeof e === 'string' ? e.substring(0, 80) : Object.keys(e).slice(0, 10))
process.exit(0)
