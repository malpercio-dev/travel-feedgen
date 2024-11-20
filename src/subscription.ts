import { CommitCreateEvent, Jetstream } from '@skyware/jetstream'
import { ALLOW_FILTER_PHRASES, DAYS_BACK, DENY_FILTER_PHRASES, MAXIMUM_TAGS } from './constants.js'
import { Database } from './db/index.js'
import { AppBskyFeedPost } from '@atproto/api'

export class JetstreamSubscription {
  public jetstream: Jetstream
  private intervalId: NodeJS.Timeout

  private constructor(public db: Database, public jetstreamUrl: string) {}

  static async create(db: Database, jetstreamUrl: string): Promise<JetstreamSubscription> {
    const sub = new JetstreamSubscription(db, jetstreamUrl)
    const cursor = await sub.getCursor()
    const sevenDaysAgoCursor = (Date.now() * 1000) - 604_800_000_000;
    console.log(sevenDaysAgoCursor);
    console.log("Db cursor", cursor)
    sub.jetstream = new Jetstream({
      endpoint: jetstreamUrl,
      wantedCollections: ["app.bsky.feed.post"],
      cursor: cursor.cursor ?? sevenDaysAgoCursor,
    });

    sub.jetstream.on("open", () => {
      console.log("jetstream open")
      console.log("current cursor", sub.jetstream.cursor)
      sub.intervalId = setInterval(async () => {
        if (!sub.jetstream.cursor) return
        console.log("updating cursor", sub.jetstream.cursor)
        await sub.updateCursor(sub.jetstream.cursor)
        console.log("current cursor", sub.jetstream.cursor)
      }, 60_000)
    })

    sub.jetstream.on("error", (err) => console.error(err))
    sub.jetstream.on("close", () => clearInterval(sub.intervalId))

    return sub
  }

  async run(subscriptionReconnectDelay: number) {
    try {
      this.jetstream.onCreate("app.bsky.feed.post", event => {
        this.handleEvent(event).catch((err) => {
          console.error('repo subscription could not handle message', err)
        })
      })
      this.jetstream.start()
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(
        () => this.run(subscriptionReconnectDelay),
        subscriptionReconnectDelay,
      )
    }
  }

  async updateCursor(cursor: number) {
    const cur = await this.getCursor();
    if (!cur) {
      await this.db
      .insertInto('sub_state')
      .values({ cursor, service: this.jetstreamUrl })
      .execute()
    } else {
      await this.db
        .updateTable('sub_state')
        .set({ cursor })
        .where('service', '=', this.jetstreamUrl)
        .execute()
    }
  }

  async getCursor(): Promise<{ cursor?: number }> {
    const res = await this.db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', this.jetstreamUrl)
      .executeTakeFirst()
    return res ? { cursor: res.cursor } : {}
  }

  async handleEvent(evt: CommitCreateEvent<"app.bsky.feed.post">) {
    const record = evt.commit.record as unknown as AppBskyFeedPost.Record
    
    const isTestUser = evt.did === "did:plc:hocpjcktw5xtk6ptjpxlth4d";

    const today = new Date()
    const daysAgo = new Date()
    daysAgo.setDate(today.getDate() - DAYS_BACK)
    const dateFilter = new Date(record.createdAt) >= daysAgo

    const allowFilter = ALLOW_FILTER_PHRASES.filter((phrase) => record.text.toLowerCase().includes(phrase.toLowerCase()))

    const denyFilter = DENY_FILTER_PHRASES.filter((phrase) => record.text.toLowerCase().includes(phrase.toLowerCase()))
    
    const tagFilter = record.facets?.filter((facet) => facet.features.filter((feature) => Object.hasOwn(feature, 'tag'))) ?? []
    
    if (isTestUser) {
      console.log("event", evt);
      console.log("dateFilter", dateFilter)
      console.log("allowFilter", allowFilter)
      console.log("denyFilter", denyFilter)
      console.log("tagFilter", tagFilter)
    }

    if (dateFilter && allowFilter.length > 0 && denyFilter.length <= 0 && tagFilter.length <= MAXIMUM_TAGS) {
      const uri = `at://${evt.did}/${evt.commit.collection}/${evt.commit.rkey}`;
			const cid = evt.commit.cid;
      const post = {
        uri: uri,
        cid: cid,
        indexedAt: new Date().toISOString(),
        createdAt: new Date(record.createdAt).toISOString()
      }
      await this.db
        .insertInto('post')
        .values(post)
        .onConflict((oc) => oc.doNothing())
        .execute()
      console.log("added post!")
    }
  }
}
