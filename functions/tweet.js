const DynamoDB = require('aws-sdk/clients/dynamodb')
const DocumentClient = new DynamoDB.DocumentClient()
const ulid = require('ulid')
const { TweetTypes } = require('../lib/constants')

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE } = process.env

module.exports.handler = async (event) => {
  const { text } = event.arguments // this mutation just takes teh text, extract from event argument
  const { username } = event.identity // both fields that direct lambda invokacation will direct to the function
  const id = ulid.ulid() // new ulid for the tweet
  const timestamp = new Date().toJSON() // timestamp while we are here

  const newTweet = {
    __typename: TweetTypes.TWEET, //'Tweet', //see how this is useful when we implement getTweet/getTimeline later. When it comes to returning tweets, itweet array interface. Response need this field rather than extra complexity in the get, write the record in the first place.
    id,
    text,
    creator: username, // username of the logged in user
    createdAt: timestamp, // current timestamp
    replies: 0,
    likes: 0,
    retweets: 0
  }

  await DocumentClient.transactWrite({
    TransactItems: [{
      Put: {
        TableName: TWEETS_TABLE,
        Item: newTweet
      }
    }, {
      Put: {
        TableName: TIMELINES_TABLE,
        Item: {
          userId: username,
          tweetId: id,
          timestamp
        }
      }
    }, {
      Update: {
        TableName: USERS_TABLE,
        Key: {
          id: username
        },
        UpdateExpression: 'ADD tweetsCount :one',
        ExpressionAttributeValues: {
          ':one': 1
        },
        ConditionExpression: 'attribute_exists(id)'
      }
    }]
  }).promise()

  return newTweet
}