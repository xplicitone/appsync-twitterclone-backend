const DynamoDB = require('aws-sdk/clients/dynamodb')
const DocumentClient = new DynamoDB.DocumentClient()
const ulid = require('ulid')
const { TweetTypes } = require('../lib/constants')

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE, RETWEETS_TABLE } = process.env

module.exports.handler = async (event) => {
  const { tweetId } = event.arguments // this mutation just takes teh text, extract from event argument
  const { username } = event.identity // both fields that direct lambda invokacation will direct to the function
  const id = ulid.ulid() // new ulid for the tweet
  const timestamp = new Date().toJSON() // timestamp while we are here

  // Fetch Original Tweet
  const getTweetResp = await DocumentClient.get({
    TableName: TWEETS_TABLE,
    Key: {
      id: tweetId
    }
  }).promise()

  const tweet = getTweetResp.Item
  if (!tweet) {
    throw new Error('Tweet is not found')
  }


  const newTweet = {
    __typename: TweetTypes.RETWEET, //'Retweet', //see how this is useful when we implement getTweet/getTimeline later. When it comes to returning tweets, itweet array interface. Response need this field rather than extra complexity in the get, write the record in the first place.
    id,
    creator: username, // username of the logged in user
    createdAt: timestamp, // current timestamp
    retweetOf: tweetId
  }

  const transactItems = [{
    Put: {
      TableName: TWEETS_TABLE,
      Item: newTweet
    }
  }, {
    Put: {
      TableName: RETWEETS_TABLE,
      Item: {
        userId: username,
        tweetId,
        createdAt: timestamp
      },
      ConditionExpression: 'attribute_not_exists(tweetId)' // so you cannot retweet the same tweet twice
    }
  }, {
    Update: {
      TableName: TWEETS_TABLE,
      Key: {
        id: tweetId
      },
      UpdateExpression: 'ADD retweets :one',
      ExpressionAttributeValues: {
        ':one': 1
      },
      ConditionExpression: 'attribute_exists(id)'
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

  console.log(`creator: [${tweet.creator}; username: [${username}]]`)
  if (tweet.creator !== username) {
    transactItems.push({
      Put: {
        TableName: TIMELINES_TABLE,
        Item: {
          userId: username,
          tweetId: id,
          retweetOf: tweetId, // this is strictly for looking at the database, we can quickly tell if it's a retweet or tweet or reply.
          timestamp
        }
      }
    })
  }

  await DocumentClient.transactWrite({
    TransactItems: transactItems
  }).promise()

  return true
}