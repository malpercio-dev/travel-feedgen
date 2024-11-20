import { Database } from './db/index'
import { DidResolver } from '@atproto/identity'

export type AppContext = {
  db: Database
  didResolver: DidResolver
  cfg: Config
}

export type Config = {
  port: number
  listenhost: string
  hostname: string
  sqliteLocation: string
  serviceDid: string
  publisherDid: string
  subscriptionReconnectDelay: number
  jetstreamUrl: string
}
