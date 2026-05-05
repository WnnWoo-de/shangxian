import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-d1-sql-to-mysql.js <d1-export.sql> <mysql-output.sql>')
  process.exit(1)
}

const normalizeSqliteDump = (sql) => sql
  .replace(/^PRAGMA .*?;\s*/gim, '')
  .replace(/^BEGIN TRANSACTION;\s*/gim, '')
  .replace(/^COMMIT;\s*/gim, '')
  .replace(/^CREATE TABLE sqlite_sequence.*?;\s*/gims, '')
  .replace(/^INSERT INTO sqlite_sequence.*?;\s*/gim, '')

const convertSchemaFragments = (sql) => sql
  .replace(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\);/m, '')
  .replace(/CREATE TABLE IF NOT EXISTS customers \([\s\S]*?\);/m, '')
  .replace(/CREATE TABLE IF NOT EXISTS fabrics \([\s\S]*?\);/m, '')
  .replace(/CREATE TABLE IF NOT EXISTS bills \([\s\S]*?\);/m, '')
  .replace(/ALTER TABLE customers ADD COLUMN deleted_at TEXT;\s*/g, '')
  .replace(/ALTER TABLE fabrics ADD COLUMN deleted_at TEXT;\s*/g, '')
  .replace(/ALTER TABLE bills ADD COLUMN deleted_at TEXT;\s*/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS .*?;\s*/g, '')

const convertInsertSyntax = (sql) => sql
  .replace(/INSERT OR IGNORE INTO/g, 'INSERT IGNORE INTO')
  .replace(/INSERT OR REPLACE INTO/g, 'REPLACE INTO')
  .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP(3)')

const wrapOutput = (body) => `SET NAMES utf8mb4;\nSET time_zone = '+00:00';\n\nSOURCE migrations/mysql_schema.sql;\n\nSTART TRANSACTION;\n${body.trim()}\nCOMMIT;\n`

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = readFileSync(resolve(rootDir, inputPath), 'utf8')
const converted = wrapOutput(convertInsertSyntax(convertSchemaFragments(normalizeSqliteDump(input))))

writeFileSync(resolve(rootDir, outputPath), converted, 'utf8')
console.log(`Converted ${inputPath} -> ${outputPath}`)
