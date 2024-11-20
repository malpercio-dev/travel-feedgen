// max 15 chars
export const FEED_NAME = 'travel'

// maximum age of a post in the feed
export const DAYS_BACK = 7

// any phrases that, if included in the post, will flag the post for inclusion
export const ALLOW_FILTER_PHRASES = ['✈️🗺️']

// any phrases that will make any previously eligible post ineligible
export const DENY_FILTER_PHRASES = [
    "let's connect",
    'follow back',
    'follow me',
    'all-inclusive',
    'all inclusive'
]

// any posts that contain more hashtags than this will be ineligible
export const MAXIMUM_TAGS = 3