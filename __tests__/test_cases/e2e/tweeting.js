require('dotenv').config()
const { before } = require('lodash')
const given = require('../../steps/given')
const then = require('../../steps/then')
const when = require('../../steps/when')
const chance = require('chance').Chance()

describe('Given an authenticated user', () => {
  let userA
  beforeAll(async () => {
    // create and capture the user
    userA = await given.an_authenticated_user()
  })

  // as we did in the integration test, we say when they send a tweet.
  // kick off the whole flow of actions in this user journey
  describe('When they send a tweet', () => {
    let tweet // capture the tweet

    const text = chance.string({ length: 16 })

    // send tweet
    beforeAll(async () => {
      // instead of invoking the function...
      tweet = await when.a_user_calls_tweet(userA, text)
    })

    // since we wrote integration tests to make sure when that function runs, it writes tweet to tweets table, timelines table and users table, no strong need to replicate those steps.
    // so, make sure graphQl schema and resolvers are configured correctly so we get right data back and validate that this mutation returns valid new tweet.
    it('Should return the new tweet', () => {
      expect(tweet).toMatchObject({
        // if we look at GraphQL schema, look Tweet Type. Because id is a not null and random string, can't expect to look like anything.
        text,
        replies: 0,
        likes: 0,
        retweets: 0,
        liked: false
      })
    })

    describe('When they call getTweets', () => {
      let tweets, nextToken
      beforeAll(async () => {
        const result = await when.a_user_calls_getTweets(userA, userA.username, 25)
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
        await expect(when.a_user_calls_getTweets(userA, userA.username, 26))
          .rejects
          .toMatchObject({
            message: expect.stringContaining('max limit is 25')
          })
      })      
    })

    describe('When they call getMyTimeline', () => {
      let tweets, nextToken
      beforeAll(async () => {
        const result = await when.a_user_calls_getMyTimeline(userA, 25)
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
        await expect(when.a_user_calls_getMyTimeline(userA, 26))
          .rejects
          .toMatchObject({
            message: expect.stringContaining('max limit is 25')
          })
      })      
    })

    describe('When they like the tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_like(userA, tweet.id)
      })

      it('Should see Tweet.liked as true', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25)

        expect(tweets).toHaveLength(1)
        expect(tweets[0].id).toEqual(tweet.id)
        expect(tweets[0].liked).toEqual(true)
      })

      it('Should not be able to like the same tweet a second time', async () => {
        await expect(() => when.a_user_calls_like(userA, tweet.id))
          .rejects
          .toMatchObject({
            message: expect.stringContaining('DynamoDB transaction error')
          })
      })

      it('Should see this tweet when they call getLikes', async () => {
        const { tweets, nextToken } = await when.a_user_calls_getLikes(userA, userA.username, 25)

        expect(nextToken).toBeNull()
        expect(tweets).toHaveLength(1)
        expect(tweets[0]).toMatchObject({
          ...tweet,
          liked: true,
          likes: 1,
          profile: {
            ...tweet.profile,
            likesCount: 1
          }
        })
      })

      describe('When he unlikes the tweet', () => {
        beforeAll(async () => {
          await when.a_user_calls_unlike(userA, tweet.id)
        })

        it('Should see Tweet.liked as false', async () => {
          const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25)
  
          expect(tweets).toHaveLength(1)
          expect(tweets[0].id).toEqual(tweet.id)
          expect(tweets[0].liked).toEqual(false)
        })
  
        it('Should not be able to unlike the same tweet a second time', async () => {
          await expect(() => when.a_user_calls_unlike(userA, tweet.id))
            .rejects
            .toMatchObject({
              message: expect.stringContaining('DynamoDB transaction error')
            })
        })

        it('Should not see this tweet when getLikes is called again', async () => {
          const { tweets, nextToken } = await when.a_user_calls_getLikes(userA, userA.username, 25)

          expect(nextToken).toBeNull()
          expect(tweets).toHaveLength(0)
        })
      })
    })

    describe('When they retweet the tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_retweet(userA, tweet.id) 
      })

      it('Should see the retweet when he calls getTweets', async () => {
        const { tweets } = await when.a_user_calls_getTweets(userA, userA.username, 25)

        expect(tweets).toHaveLength(2) // including first tweet and then the retweet
        expect(tweets[0]).toMatchObject({      //expect newer tweet aka the retweet to come earlier
          profile: {
            id: userA.username,
            tweetsCount: 2
          },
          retweetOf: {
            ...tweet,
            retweets: 1,
            retweeted: true,
            profile: {
              id: userA.username,
              tweetsCount: 2
            }
          }
        })
        expect(tweets[1]).toMatchObject({
          ...tweet,
          retweets: 1,
          retweeted: true,
          profile: {
            id: userA.username,
            tweetsCount: 2
          }
        })
      })

      it('Should not see the retweet when he calls getMyTimeline', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25)

        expect(tweets).toHaveLength(1) // only 1 because when you retweet your own it does not get added to your timeline
        expect(tweets[0]).toMatchObject({
          ...tweet,
          retweets: 1,
          retweeted: true,
          profile: {
            id: userA.username,
            tweetsCount: 2
          }
        })
      })

      describe('When they unretweets the tweet', () => {
        beforeAll(async () => {
          await when.a_user_calls_unretweet(userA, tweet.id) 
        })

        it('Should not see the retweet when they call getTweets anymore', async () => {
          const { tweets } = await when.a_user_calls_getTweets(userA, userA.username, 25)

          expect(tweets).toHaveLength(1) // should see original tweet and not the retweet anymore
          expect(tweets[0]).toMatchObject({
            ...tweet,
            retweets: 0,
            retweeted: false,
            profile: {
              id: userA.username,
              tweetsCount: 1
            }
          })
        })
      })
    })

    describe('given another user, user B, sends a tweet', () => {
      let userB, anotherTweet
      const text = chance.string({ length: 16 })
      beforeAll(async () => {
        // create and capture the user
        userB = await given.an_authenticated_user()
        anotherTweet = await when.a_user_calls_tweet(userB, text)
      })

      describe("When user A retweets user B's tweet", () => {
        beforeAll(async () => {
          await when.a_user_calls_retweet(userA, anotherTweet.id)
        })

        it('Should see the retweet when he calls getTweets', async () => {
          const { tweets } = await when.a_user_calls_getTweets(userA, userA.username, 25)
  
          expect(tweets).toHaveLength(2) // including first tweet and then the retweet
          expect(tweets[0]).toMatchObject({      //expect newer tweet aka the retweet to come earlier
            profile: {
              id: userA.username,
              tweetsCount: 2
            },
            retweetOf: {
              ...anotherTweet,
              retweets: 1,
              retweeted: true
            }
          })
        })
  
        it('Should see the retweet when they calls getMyTimeline', async () => {
          const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25)
  
          expect(tweets).toHaveLength(2)
          expect(tweets[0]).toMatchObject({
            profile: {
              id: userA.username,
              tweetsCount: 2
            },
            retweetOf: {
              ...anotherTweet,
              retweets: 1,
              retweeted: true
            }
          })
        })

        describe ("When user A unretweets user B's tweet", () => {
          beforeAll(async () => {
            await when.a_user_calls_unretweet(userA, anotherTweet.id)
          })

          it('User A should not see the retweet when they call getTweets anymore', async () => {
            const { tweets } = await when.a_user_calls_getTweets(userA, userA.username, 25)

            expect(tweets).toHaveLength(1) // should see original tweet and not the retweet anymore
            expect(tweets[0]).toMatchObject({
              ...tweet,
              retweets: 0,
              retweeted: false,
              profile: {
                id: userA.username,
                tweetsCount: 1
              }
            })
          })
          
          it('User A should not see the retweet when they call getMyTimeline anymore', async () => {
            const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25)
  
            expect(tweets).toHaveLength(1)
            expect(tweets[0]).toMatchObject({
              ...tweet,
              profile: {
                id: userA.username,
                tweetsCount: 1
              }
            })
          })
        })
      })
    })
  })
})