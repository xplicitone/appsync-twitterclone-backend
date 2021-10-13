const S3 = require('aws-sdk/clients/s3')
const s3 = new S3({ useAccelerateEndpoint: true })
const ulid = require('ulid')

const { BUCKET_NAME } = process.env

module.exports.handler = async (event) => {
  const id = ulid.ulid()
  let key = `${event.identity.username}/${id}`

  const extension = event.arguments.extension
  if (extension) {
    if (extension.startsWith('.')) {
      key += extension
    } else { 
      key += `.${extension}`
    }
  }

  // contentType is optional, so if it's not present, default to a jpeg image
  const contentType = event.arguments.contentType || 'image/jpeg'

  if (!contentType.startsWith('image/')) {
    throw new Error('content type should be an image!')
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    ACL: 'public-read',
    ContentType: contentType
  }

  // getSignedUrl doesn't actually make aany requests to S3, and is completely generated locally, so that's why we don't need a promise and await here.
  const signedUrl = s3.getSignedUrl('putObject', params)
  return signedUrl
}