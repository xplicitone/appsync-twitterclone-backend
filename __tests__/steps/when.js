require('dotenv').config()
const AWS = require('aws-sdk')
const fs = require('fs')
const velocityMapper = require('amplify-appsync-simulator/lib/velocity/value-mapper/mapper')
const velocityTemplate = require('amplify-velocity-template')
const { GraphQL, registerFragment } = require('../lib/graphql')

const myProfileFragment = `
fragment myProfileFields on MyProfile {
  id
  name
  screenName
  imageUrl
  backgroundImageUrl
  bio
  location
  website
  birthdate
  createdAt
  followersCount
  followingCount
  tweetsCount
  likesCount
}
`

const otherProfileFragment = `
fragment otherProfileFields on OtherProfile {
  id
  name
  screenName
  imageUrl
  backgroundImageUrl
  bio
  location
  website
  birthdate
  createdAt
  followersCount
  followingCount
  tweetsCount
  likesCount
}
`

const iProfileFragment = `
fragment iProfileFields on IProfile {
  ... on MyProfile {
    ... myProfileFields
  }
  
  ... on OtherProfile {
    ... otherProfileFields
  }
}
`

const tweetFragment = `
fragment tweetFields on Tweet {
  id
  profile {
    ... iProfileFields
  }
  createdAt
  text
  replies
  likes
  retweets
  liked
}
`

const iTweetFragment = `
fragment iTweetFields on ITweet {
  ... on Tweet {
    ... tweetFields
  }
}
`

registerFragment('myProfileFields', myProfileFragment)
registerFragment('otherProfileFields', otherProfileFragment)
registerFragment('iProfileFields', iProfileFragment)
registerFragment('tweetFields', tweetFragment)
registerFragment('iTweetFields', iTweetFragment)

const we_invoke_confirmUserSignup = async (username, name, email) => {
  // use this to construct an event payload to call the confirmUserSignup
  const handler = require('../../functions/confirm-user-signup').handler

  const context = {}
  // create the event payload itself
  const event = {
    "version": "1",
    "region": process.env.AWS_REGION,
    "userPoolId": process.env.COGNITO_USER_POOL_ID,
    "userName": username,
    "triggerSource": "PostConfirmation_ConfirmSignUp",
    "request": {
      "userAttributes": {
        "sub": username,
        "cognito:email_alias": email,
        "cognito:user_status": "CONFIRMED",
        "email_verified": "false",
        "name": name,
        "email": email
      }
    },
    "response": {}
  }

  // invoke handler function
  await handler(event, context)
}

const we_invoke_getImageUploadUrl = async (username, extension, contentType) => {

  // use this to construct an event payload to call the get-upload-url Lambda
  const handler = require('../../functions/get-upload-url').handler

  const context = {}
  // create the event payload itself
  const event = {
    identity: {
      username
    },
    arguments: {
      extension,
      contentType
    }
  }

  // invoke handler function and return the invokation which is going to be the signed S3 URL
  return await handler(event, context)

}

const we_invoke_tweet = async (username, text) => {

  // use this to construct an event payload to call the tweet Lambda
  const handler = require('../../functions/tweet').handler

  const context = {}
  // create the event payload itself
  const event = {
    identity: {
      username
    },
    arguments: {
      text
    }
  }

  // invoke handler function and return the invokation which is going to be the signed S3 URL
  return await handler(event, context)

}

// we'll actually have to talk to Cognito so bring in the aws-sdk
const a_user_signs_up = async (password, name, email) => {
  const cognito = new AWS.CognitoIdentityServiceProvider()

  const userPoolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.WEB_COGNITO_USER_POOL_CLIENT_ID

  const signUpResp = await cognito.signUp({
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'name', Value: name }
    ]
  }).promise()

  const username = signUpResp.UserSub
  console.log(`[${email}] - user has signed up [${username}]`)

  // we need to get verification code from the email but don't so....
  // allows us to skip verification code and confirm the user in cognito 
  // which is going to tgrigger confirm user signup funciton by post confirmation hook
  await cognito.adminConfirmSignUp({
    UserPoolId: userPoolId,
    Username: username
  }).promise()

  console.log(`[${email}] - confirmed sign up`)

  return {
    username,
    name, 
    email
  }
}

const we_invoke_an_appsync_template = (templatePath, context) => {
  const template = fs.readFileSync(templatePath, { encoding: 'utf-8' })
  const ast = velocityTemplate.parse(template)
  const compiler = new velocityTemplate.Compile(ast, {
    valueMapper: velocityMapper.map,
    escape: false
  })
  return JSON.parse(compiler.render(context))
}

const a_user_calls_getMyProfile = async (user) => {
  const getMyProfile = `query getMyProfile {
    getMyProfile {
      ... myProfileFields
    }
  }`

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, getMyProfile, {}, user.accessToken)
  //can see data.getMyProfile in appsync console with successful query
  const profile = data.getMyProfile

  console.log(`[${user.username}] - fetched profile`)

  return profile
}

const a_user_calls_editMyProfile = async (user, input) => {
  const editMyProfile = `mutation editMyProfile($input: ProfileInput!) {
    editMyProfile(newProfile: $input) {
      ... myProfileFields
    }
  }`

  const variables = {
    input
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, editMyProfile, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const profile = data.editMyProfile

  console.log(`[${user.username}] - edited profile`)

  return profile
}

const a_user_calls_getImageUploadUrl = async (user, extension, contentType) => {
  const getImageUploadUrl = `query getImageUploadUrl($extension: String, $contentType: String) {
    getImageUploadUrl(extension: $extension, contentType: $contentType) 
  }`

  const variables = {
    extension,
    contentType
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, getImageUploadUrl, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const url = data.getImageUploadUrl

  console.log(`[${user.username}] - got image upload url`)

  return url
}

const a_user_calls_tweet = async (user, text) => {
  const tweet = `mutation tweet($text: String!) {
    tweet(text: $text)  {
      id
      profile {
        ... iProfileFields
      }
      createdAt
      text
      replies
      likes
      retweets,
      liked
    }
  }`

  const variables = {
    text
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, tweet, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const newTweet = data.tweet

  console.log(`[${user.username}] - posted new tweet`)

  return newTweet
}

const a_user_calls_getTweets = async (user, userId, limit, nextToken) => {
  const getTweets = `query getTweets($userId: ID!, $limit: Int!, $nextToken: String) {
    getTweets(userId: $userId, limit: $limit, nextToken: $nextToken) {
      nextToken
      tweets {
        ... iTweetFields
      }
    }
  }`

  const variables = {
    userId,
    limit,
    nextToken
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, getTweets, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const result = data.getTweets

  console.log(`[${user.username}] - posted new tweet`)

  return result
}

const a_user_calls_getMyTimeline = async (user, limit, nextToken) => {
  const getMyTimeline = `query getMyTimeline($limit: Int!, $nextToken: String) {
    getMyTimeline(limit: $limit, nextToken: $nextToken) {
      nextToken
      tweets {
        ... iTweetFields
      }
    }
  }`

  const variables = {
    limit,
    nextToken
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, getMyTimeline, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const result = data.getMyTimeline

  console.log(`[${user.username}] - fetched timeline`)

  return result
}

const a_user_calls_like = async (user, tweetId) => {
  const like = `mutation like($tweetId: ID!) {
    like(tweetId: $tweetId)
  }`

  const variables = {
    tweetId
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, like, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const result = data.like

  console.log(`[${user.username}] - liked tweet [${tweetId}]`)

  return result
}

const a_user_calls_unlike = async (user, tweetId) => {
  const unlike = `mutation unlike($tweetId: ID!) {
    unlike(tweetId: $tweetId)
  }`

  const variables = {
    tweetId
  }

  // helper module allows us to create request to AppSync
  // need to know AppSync API's URL, query we're trying to send, as well as any variables for query, auth header (user's access token)
  const data = await GraphQL(process.env.API_URL, unlike, variables, user.accessToken)
  //can see data.editMyProfile in appsync console with successful query
  const result = data.unlike

  console.log(`[${user.username}] - unliked tweet [${tweetId}]`)

  return result
}

module.exports = {
  we_invoke_confirmUserSignup,
  we_invoke_getImageUploadUrl,
  we_invoke_tweet,
  a_user_signs_up,
  we_invoke_an_appsync_template,
  a_user_calls_getMyProfile,
  a_user_calls_editMyProfile,
  a_user_calls_getImageUploadUrl,
  a_user_calls_tweet,
  a_user_calls_getTweets,
  a_user_calls_getMyTimeline,
  a_user_calls_like,
  a_user_calls_unlike
}