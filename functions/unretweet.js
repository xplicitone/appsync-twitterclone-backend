const _ = require('lodash')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const DocumentClient = new DynamoDB.DocumentClient()

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE, RETWEETS_TABLE } = process.env

module.exports.handler = async (event) => {
  const { tweetId } = event.arguments // tweet id for the tweet that we tweeted (we want to delete) [not the tweet id of the retweet]
  const { username } = event.identity // both fields that direct lambda invokacation will direct to the function

  // Fetch Original Tweet
  const getTweetResp = await DocumentClient.get({
    TableName: TWEETS_TABLE,
    Key: {
      id: tweetId
    }
  }).promise()

  // validation to make sure the tweet was want to unretweet exists
  const tweet = getTweetResp.Item
  if (!tweet) {
    throw new Error('Tweet is not found')
  }

  // find actual retweet itself (that we want to delete)
  const queryResp = await DocumentClient.query({
    TableName: process.env.TWEETS_TABLE,
    IndexName: 'retweetsByCreator',
    KeyConditionExpression: 'creator = :creator AND retweetOf = :tweetId',
    ExpressionAttributeValues: {
      ':creator': username,
      ':tweetId': tweetId
    },
    Limit: 1
  }).promise()

  const retweet = _.get(queryResp, 'Items.0')

  if (!retweet) {
    throw new Error('Retweet is not found')
  }

  const transactItems = [{
    Delete: {
      TableName: TWEETS_TABLE,
      Key: {
        id: retweet.id
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }, {
    Delete: {
      TableName: RETWEETS_TABLE,
      Key: {
        userId: username,
        tweetId
      },
      ConditionExpression: 'attribute_exists(tweetId)'
    }
  }, {
    Update: {
      TableName: TWEETS_TABLE,
      Key: {
        id: tweetId
      },
      UpdateExpression: 'ADD retweets :minusOne',
      ExpressionAttributeValues: {
        ':minusOne': -1
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }, {
    Update: {
      TableName: USERS_TABLE,
      Key: {
        id: username
      },
      UpdateExpression: 'ADD tweetsCount :minusOne',
      ExpressionAttributeValues: {
        ':minusOne': -1
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }]

  console.log(`creator: [${tweet.creator}; username: [${username}]]`)
  if (tweet.creator !== username) {
    transactItems.push({
      Delete: {
        TableName: TIMELINES_TABLE,
        Key: {
          userId: username,
          tweetId: retweet.id
        }
      }
    })
  }

  await DocumentClient.transactWrite({
    TransactItems: transactItems
  }).promise()

  return true
}