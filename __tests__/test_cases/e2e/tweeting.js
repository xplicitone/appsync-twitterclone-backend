require('dotenv').config()
const given = require('../../steps/given')
const then = require('../../steps/then')
const when = require('../../steps/when')
const chance = require('chance').Chance()

describe('Given an authenticated user', () => {
  let user
  beforeAll(async () => {
    // create and capture the user
    user = await given.an_authenticated_user()
  })

  // as we did in the integration test, we say when they send a tweet.
  // kick off the whole flow of actions in this user journey
  describe('When they send a tweet', () => {
    let tweet // capture the tweet

    const text = chance.string({ length: 16 })

    // send tweet
    beforeAll(async () => {
      // instead of invoking the function...
      tweet = await when.a_user_calls_tweet(user, text)
    })

    // since we wrote integration tests to make sure when that function runs, it writes tweet to tweets table, timelines table and users table, no strong need to replicate those steps.
    // so, make sure graphQl schema and resolvers are configured correctly so we get right data back and validate that this mutation returns valid new tweet.
    it('Should return the new tweet', () => {
      expect(tweet).toMatchObject({
        // if we look at GraphQL schema, look Tweet Type. Because id is a not null and random string, can't expect to look like anything.
        text,
        replies: 0,
        likes: 0,
        retweets: 0
      })
    })

    describe('When they call getTweets', () => {
      let tweets, nextToken
      beforeAll(async () => {
        const result = await when.a_user_calls_getTweets(user, user.username, 25)
        tweets = result.tweets
        nextToken = result.nextToken
      })

      // extend this flow to say, after the user has sent a tweet, can then use getTweets to get their tweets, and see the new tweet
      it('They will see the new tweet when he calls getTweets', () => {
        // get rid of async above because we're getting rid of the below line as well and moving it above in beforeAll
        //const { tweets, nextToken } = await when.a_user_calls_getTweets(user, user.username, 25)
  
        expect(nextToken).toBeNull()
        expect(tweets.length).toEqual(1) // should only be 1 tweet
        expect(tweets[0]).toEqual(tweet)
      })
  
      it('They cannot ask for more than 25 tweets in a page.', async () => {
        await expect(when.a_user_calls_getTweets(user, user.username, 26))
          .rejects
          .toMatchObject({
            message: expect.stringContaining('max limit is 25')
          })
      })      
    })

    describe('When they call getTyTimeline', () => {
      let tweets, nextToken
      beforeAll(async () => {
        const result = await when.a_user_calls_getTimeline(user, 25)
        tweets = result.tweets
        nextToken = result.nextToken
      })

      // extend this flow to say, after the user has sent a tweet, can then use getTweets to get their tweets, and see the new tweet
      it('They will see the new tweet when he calls getTweets', () => {
        // get rid of async above because we're getting rid of the below line as well and moving it above in beforeAll
        //const { tweets, nextToken } = await when.a_user_calls_getTweets(user, 25)
  
        expect(nextToken).toBeNull()
        expect(tweets.length).toEqual(1) // should only be 1 tweet
        expect(tweets[0]).toEqual(tweet)
      })
  
      it('They cannot ask for more than 25 tweets in a page.', async () => {
        await expect(when.a_user_calls_getTimeline(user, 26))
          .rejects
          .toMatchObject({
            message: expect.stringContaining('max limit is 25')
          })
      })      
    })

  })
})