import * as dotenv from 'dotenv'
dotenv.config()

import { WatcherServer } from './app'

const server = new WatcherServer()
const app = server.getApp()
const io = server.getIo()

export { app, io }
