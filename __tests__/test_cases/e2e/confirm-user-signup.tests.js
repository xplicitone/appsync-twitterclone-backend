const given = require('../../steps/given')
const when = require('../../steps/when')
const then = require('../../steps/then')

describe('When a user signs up', () => {
  it("The user's profile should be saved in DynamoDB", async () => {
    const { password, name, email } = given.a_random_user()
    //const username = chance.guid() // generating a username will come from Cognito

    // construct an event and call user sign up with name email and pw, need to know users username assigned by cognito
    const user = await when.a_user_signs_up(password, name, email)

    // expect exist in DynamoDB and use username to lookitup
    const ddbUser = await then.user_exists_in_UsersTable(user.username)
    expect(ddbUser).toMatchObject({
      id: user.username,
      name,
      createdAt: expect.stringMatching(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?Z?/g),
      followersCount: 0,
      followingCount: 0,
      tweetsCount: 0,
      likesCount: 0
    })

    const [firstName, lastName] = name.split(' ')
    expect(ddbUser.screenName).toContain(firstName)
    expect(ddbUser.screenName).toContain(lastName)
  })
})