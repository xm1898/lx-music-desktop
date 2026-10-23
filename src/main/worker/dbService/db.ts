import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import tables, { DB_VERSION } from './tables'
import verifyDB from './verifyDB'
import migrateData from './migrate'

let db: Database.Database


const initTables = (db: Database.Database) => {
  db.exec(`
    ${Array.from(tables.values()).join('\n')}
    INSERT INTO "main"."db_info" ("field_name", "field_value") VALUES ('version', '${DB_VERSION}');
  `)
}


// 定位 better-sqlite3 原生模块：优先 node-gyp 编译产物，回退 npm 包自带 prebuild
const resolveNativeBinding = (): string | undefined => {
  const candidates = [
    path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
    path.join(__dirname, '../node_modules/better-sqlite3/prebuilds', `${process.platform}-${process.arch}.node`),
  ]
  return candidates.find(p => fs.existsSync(p))
}


// 打开、初始化数据库
export const init = (lxDataPath: string): boolean | null => {
  const databasePath = path.join(lxDataPath, 'lx.data.db')
  const nativeBinding = resolveNativeBinding()
  let dbFileExists = true

  try {
    db = new Database(databasePath, {
      fileMustExist: true,
      nativeBinding,
      // verbose: process.env.NODE_ENV !== 'production' ? console.log : undefined,
    })
  } catch (error) {
    console.log(error)
    db = new Database(databasePath, {
      nativeBinding,
      // verbose: process.env.NODE_ENV !== 'production' ? console.log : undefined,
    })
    initTables(db)
    dbFileExists = false
  }
  db.pragma('journal_mode = WAL')

  if (dbFileExists) migrateData(db)

  // https://www.sqlite.org/pragma.html#pragma_optimize
  if (dbFileExists) db.exec('PRAGMA optimize;')
  if (!verifyDB(db)) {
    db.close()
    return null
  }

  // https://www.sqlite.org/lang_vacuum.html
  // db.exec('VACUUM "main"')

  process.on('exit', () => db.close())
  console.log('db inited')
  // require('./test')
  return dbFileExists
}

// 获取数据库实例
export const getDB = (): Database.Database => db
