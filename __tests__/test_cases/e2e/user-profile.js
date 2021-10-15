// Call getImageUploadUrl GraphQL Quest to get a URL
// Upload image to URL
//Test image that we uploaded and download it later.

require('dotenv').config()
const given = require('../../steps/given')
const then = require('../../steps/then')
const when = require('../../steps/when')
const chance = require('chance').Chance()
const path = require('path')

describe('Given an authenticated user', () => {
  let user, profile
  beforeAll(async () => {
    user = await given.an_authenticated_user()
  })

  it('The user can fetch his profile with getMyProfile', async () => {
    profile = await when.a_user_calls_getMyProfile(user)

    expect(profile).toMatchObject({
      id: user.username,
      name: user.name,
      imageUrl: null,
      backgroundImageUrl: null,
      bio: null,
      location: null,
      website: null,
      birthdate: null,
      createdAt: expect.stringMatching(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?Z?/g),
      //tweets
      followersCount: 0,
      followingCount: 0,
      tweetsCount: 0,
      likesCount: 0,
      tweets: {
        nextToken: null,
        tweets: []
      }
    })

    // can check the user's screenName is constructed with first name and last name of the user
    // except now we are checking against profile not the dynamodb user.
    const [firstName, lastName] = profile.name.split(' ')
    expect(profile.screenName).toContain(firstName)
    expect(profile.screenName).toContain(lastName)
  })

  it('The user can get a URL to upload new profile image', async () => {
    const uploadUrl = await when.a_user_calls_getImageUploadUrl(user, '.png', 'image/png')

    const bucketName = process.env.BUCKET_NAME
    const regex = new RegExp(`https://${bucketName}.s3-accelerate.amazonaws.com/${user.username}/.*\.png\?.*Content-Type=image%2Fpng.*`)
    expect(uploadUrl).toMatch(regex)

    // Not good enough. this above just tells us AppSync API returns a URL that is in the right format. If Lambda functions itself has missing permissions, then when we try to us URL that is when we will see an error. 
    // So should also actually use URL to upload an image and see whether or not we can actually download it afterwards to see everything is fine.

    const filePath = path.join(__dirname, '../../data/destinyimage.png')
    await then.user_can_upload_image_to_url(uploadUrl, filePath, 'image/png')

    const downloadUrl = uploadUrl.split('?')[0]
    await then.user_can_download_image_from(downloadUrl)
  })

  it('The user can edit his profile with editMyProfile', async () => {
    const newName = chance.first()
    const input = {
      name: newName
    }
    const newProfile = await when.a_user_calls_editMyProfile(user, input)

    expect(newProfile).toMatchObject({
      ...profile,
      name: newName
    })

    // can check the user's screenName is constructed with first name and last name of the user
    // except now we are checking against profile not the dynamodb user.
    /*const [firstName, lastName] = profile.name.split(' ')
    expect(profile.screenName).toContain(firstName)
    expect(profile.screenName).toContain(lastName)*/
  })
})