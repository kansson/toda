import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'prune receipts and pairing codes',
  { hourUTC: 3, minuteUTC: 17 },
  internal.maintenance.prune,
  {},
)

export default crons
