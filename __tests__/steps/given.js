require('dotenv').config()
const AWS = require('aws-sdk')
const chance = require('chance').Chance()
const velocityUtil = require('amplify-appsync-simulator/lib/velocity/util')

const a_random_user = () => {
  // generate a user with a randomised name and email
  const firstName = chance.first({ nationality: 'en' })
  const lastName = chance.first({ nationality: 'en' })
  const suffix = chance.string({ length: 4, pool: 'abcdefghijklmnopqrstuvwxyz' })
  const name = `${firstName} ${lastName} ${suffix}`
  const password = chance.string({ length: 8 })
  const email = `${firstName}-${lastName}-${suffix}@appsynctwitterclone.com`

  return {
    name,
    password,
    email
  }
}

const an_appsync_context = (identity, args, result, source, info) => {
  const util = velocityUtil.create([], new Date(), Object())
  const context = {
    identity,
    args,
    arguments: args,
    result,
    source,
    info
  }
  return {
    context,
    ctx: context,
    util,
    utils: util
  }
}

//calling Cognito so sign up a user and sign in
const an_authenticated_user = async () => {
  // extract out the name, email and password
  const {name, email, password} = a_random_user()

  // look at when module a_user_signs_up. Can refactor/abstract this later
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

  const auth = await cognito.initiateAuth({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  }).promise()

  console.log(`[${email}] - signed in`)

  return {
    username,
    name, 
    email,
    idToken: auth.AuthenticationResult.IdToken,
    accessToken: auth.AuthenticationResult.AccessToken
  }
  
}

module.exports = {
  a_random_user,
  an_appsync_context,
  an_authenticated_user
}