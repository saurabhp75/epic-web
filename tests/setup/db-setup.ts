// create a databaseFile variable that points to `./tests/prisma/data.db`
// create a full path to that file with path.join(process.cwd(), databaseFile)
// set process.env.DATABASE_URL to that full path
import path from 'node:path'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'
import { afterAll, afterEach, beforeAll } from 'vitest'

// before all the tests run, use execaCommand from 'execa' to run:
// prisma migrate reset --force --skip-seed --skip-generate
// update this file path to include the process.env.VITEST_POOL_ID variable
// to keep it unique and then move this file to tests/setup/db-setup.ts.
const databaseFile = `./tests/prisma/data.${process.env.VITEST_POOL_ID || 0}.db`
const databasePath = path.join(process.cwd(), databaseFile)
process.env.DATABASE_URL = `file:${databasePath}`

// after each test, dynamically import prisma from #app/utils/db.server.ts and
// delete all the users from the database
// we dynamically import prisma so it's not loaded before the environment
// variable is set: await import('#app/utils/db.server.ts')
beforeAll(async () => {
	await execaCommand(
		'prisma migrate reset --force --skip-seed --skip-generate',
		{ stdio: 'inherit' },
	)
})

// after all the tests are finished, dynamically import prisma again and
// call prisma.$disconnect(), then delete the databaseFile with fsExtra.remove
afterEach(async () => {
	const { prisma } = await import('#app/utils/db.server.ts')
	await prisma.user.deleteMany()
})

afterAll(async () => {
	const { prisma } = await import('#app/utils/db.server.ts')
	await prisma.$disconnect()
	await fsExtra.remove(databasePath)
})
