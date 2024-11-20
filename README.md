# Travel Feed Generator

This is a feed generator for Travel related posts. Most parameters can be
configured in `src/constants.ts`.

## Overview

Feed Generators are services that provide custom algorithms to users through the AT Protocol.

They work very simply: the server receives a request from a user's server and returns a list of [post URIs](https://atproto.com/specs/at-uri-scheme) with some optional metadata attached. Those posts are then hydrated into full views by the requesting server and sent back to the client. This route is described in the [`app.bsky.feed.getFeedSkeleton` lexicon](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton).

A Feed Generator service can host one or more algorithms. The service itself is identified by DID, while each algorithm that it hosts is declared by a record in the repo of the account that created it. For instance, feeds offered by Bluesky will likely be declared in `@bsky.app`'s repo. Therefore, a given algorithm is identified by the at-uri of the declaration record. This declaration record includes a pointer to the service's DID along with some profile information for the feed.

The general flow of providing a custom algorithm to a user is as follows:
- A user requests a feed from their server (PDS) using the at-uri of the declared feed
- The PDS resolves the at-uri and finds the DID doc of the Feed Generator
- The PDS sends a `getFeedSkeleton` request to the service endpoint declared in the Feed Generator's DID doc
  - This request is authenticated by a JWT signed by the user's repo signing key
- The Feed Generator returns a skeleton of the feed to the user's PDS
- The PDS hydrates the feed (user info, post contents, aggregates, etc.)
  - In the future, the PDS will hydrate the feed with the help of an App View, but for now, the PDS handles hydration itself
- The PDS returns the hydrated feed to the user

For users, this should feel like visiting a page in the app. Once they subscribe to a custom algorithm, it will appear in their home interface as one of their available feeds.

## Getting Started

We've set up this simple server with SQLite to store and query data. Feel free to switch this out for whichever database you prefer.

1. We've implement indexing logic in `src/subscription.ts`. 


2. We've implement feed generation logic in `src/algos`

   We provided a simple implementation that uses the parameters configured
   in `src/constants.ts` to filter posts for this feed.

We've taken care of setting this server up with a did:web. However, you're free to switch this out for did:plc if you like - you may want to if you expect this Feed Generator to be long-standing and possibly migrating domains.

### Deploying your feed
Your feed will need to be accessible at the value supplied to the `FEEDGEN_HOSTNAME` environment variable.

The service must be set up to respond to HTTPS queries over port 443.

### Publishing your feed

To publish your feed, go to the script at `scripts/publishFeedGen.ts` and fill in the variables at the top. Examples are included, and some are optional. To publish your feed generator, simply run `npm run publishFeed`.

To update your feed's display data (name, avatar, description, etc.), just update the relevant variables and re-run the script.

After successfully running the script, you should be able to see your feed from within the app, as well as share it by embedding a link in a post (similar to a quote post).

## Running the Server

Install dependencies with `npm install` and then run the server with `npm run start`. This will start the server on port 3000, or what's defined in `.env`. You can then watch the filtered output in the console and access the output of the custom feed at [http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:example:alice/app.bsky.feed.generator/travel](http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:example:alice/app.bsky.feed.generator/travel).

## Some Details

### Skeleton Metadata

The skeleton that a Feed Generator puts together is, in its simplest form, a list of post URIs.

```ts
[
  {post: 'at://did:example:1234/app.bsky.feed.post/1'},
  {post: 'at://did:example:1234/app.bsky.feed.post/2'},
  {post: 'at://did:example:1234/app.bsky.feed.post/3'}
]
```

However, we include an additional location to attach some context. Here is the full schema:

```ts
type SkeletonItem = {
  post: string // post URI

  // optional reason for inclusion in the feed
  // (generally to be displayed in client)
  reason?: Reason
}

// for now, the only defined reason is a repost, but this is open to extension
type Reason = ReasonRepost

type ReasonRepost = {
  $type: 'app.bsky.feed.defs#skeletonReasonRepost'
  repost: string // repost URI
}
```

This metadata serves two purposes:

1. To aid the PDS in hydrating all relevant post information
2. To give a cue to the client in terms of context to display when rendering a post

### Authentication

If you are creating a generic feed that does not differ for different users, you do not need to check auth. But if a user's state (such as follows or likes) is taken into account, we _strongly_ encourage you to validate their auth token.

Users are authenticated with a simple JWT signed by the user's repo signing key.

This JWT header/payload takes the format:
```ts
const header = {
  type: "JWT",
  alg: "ES256K" // (key algorithm) - in this case secp256k1
}
const payload = {
  iss: "did:example:alice", // (issuer) the requesting user's DID
  aud: "did:example:feedGenerator", // (audience) the DID of the Feed Generator
  exp: 1683643619 // (expiration) unix timestamp in seconds
}
```

We provide utilities for verifying user JWTs in the `@atproto/xrpc-server` package, and you can see them in action in `src/auth.ts`.

### Pagination
You'll notice that the `getFeedSkeleton` method returns a `cursor` in its response and takes a `cursor` param as input.

This cursor is treated as an opaque value and fully at the Feed Generator's discretion. It is simply passed through the PDS directly to and from the client.

We strongly encourage that the cursor be _unique per feed item_ to prevent unexpected behavior in pagination.

We recommend, for instance, a compound cursor with a timestamp + a CID:
`1683654690921::bafyreia3tbsfxe3cc75xrxyyn6qc42oupi73fxiox76prlyi5bpx7hr72u`

