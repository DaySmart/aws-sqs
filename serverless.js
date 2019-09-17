const aws = require('aws-sdk')
const { isEmpty, isNil, mergeDeepRight, pick } = require('ramda')
const { Component } = require('@serverless/core')
const {
  createQueue,
  deleteQueue,
  getDefaults,
  getQueue,
  getAccountId,
  getArn,
  getUrl,
  getAttributes,
  setAttributes,
  updateAttributes
} = require('./utils')

const outputsList = ['arn', 'url']

const defaults = {
  name: 'serverless',
  region: 'us-east-1',
  visibilityTimeout: 30,
  maximumMessageSize: 262144,
  messageRetentionPeriod: 345600,
  delaySeconds: 0,
  receiveMessageWaitTimeSeconds: 0
}

class AwsSqsQueue extends Component {
  async default(inputs = {}) {
    const config = mergeDeepRight(getDefaults({ defaults }), inputs)
    const accountId = await getAccountId(aws)
    
    const arn = getArn({
      aws,
      accountId,
      name: config.name,
      region: config.region
    })
    
    const queueUrl = getUrl({
      aws,
      accountId,
      name: config.name,
      region: config.region
    })
    
    
    config.arn = arn
    config.url = queueUrl

    this.context.status(`Deploying`)

    const sqs = new aws.SQS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    const prevInstance = await getQueue({ sqs, queueUrl: this.state.url || queueUrl })
    var queueAttributes = {};

    if (isEmpty(prevInstance)) {
      this.context.status(`Creating`)
      await createQueue({
        sqs,
        config: config
      })
    } else {
      this.context.status(`Updating`)
      await setAttributes(sqs, queueUrl, config)
    }

    this.state.policy = queueAttributes.Policy

    this.state.name = config.name
    this.state.arn = config.arn
    this.state.url = config.url
    await this.save()

    const outputs = pick(outputsList, config)
    return outputs
  }

  async remove(inputs = {}) {

    const config = mergeDeepRight(defaults, inputs)
    config.name = inputs.name || this.state.name || defaults.name

    const sqs = new aws.SQS({
      region: config.region,
      credentials: this.context.credentials.aws
    })
    
    const accountId = await getAccountId(aws)
    
    const queueUrl = this.state.url || getUrl({
      aws,
      accountId,
      name: config.name,
      region: config.region
    })
    

    this.context.status(`Removing`)

    await deleteQueue({ sqs, queueUrl })

    this.state = {}
    await this.save()

    return {}
  }
}

module.exports = AwsSqsQueue
