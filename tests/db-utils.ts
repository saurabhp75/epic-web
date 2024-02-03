import { faker } from '@faker-js/faker'
import { UniqueEnforcer } from 'enforce-unique'
import { getPasswordHash } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'

// create a unique username enforcer here
const uniqueUsernameEnforcer = new UniqueEnforcer()

export function createUser() {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()

	// you might add a tiny bit of random alphanumeric characters to the start
	// of the username to reduce the chance of collisions.

	// transform the username to only be the first 20 characters
	// you can use .slice(0, 20) for this
	// turn the username to lowercase
	// replace any non-alphanumeric characters with an underscore
	const username = uniqueUsernameEnforcer
		.enforce(() => {
			return (
				faker.string.alphanumeric({ length: 2 }) +
				'_' +
				faker.internet.userName({
					firstName: firstName.toLowerCase(),
					lastName: lastName.toLowerCase(),
				})
			)
		})
		.slice(0, 20)
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')
	return {
		username,
		name: `${firstName} ${lastName}`,
		email: `${username}@example.com`,
	}
}

// create and export a createPassword utility here which returns a password model
// which should simply be an object with a "hash" property that's a string
// generated by bcrypt.hashSync.
// It should accept a password string as an argument that defaults to a random
// password you can get from faker:
// 💰 faker.internet.password()
export function createPassword(password: string = faker.internet.password()) {
	return {
		hash: bcrypt.hashSync(password, 10),
	}
}

let noteImages: Array<Awaited<ReturnType<typeof img>>> | undefined
export async function getNoteImages() {
	if (noteImages) return noteImages

	noteImages = await Promise.all([
		img({
			altText: 'a nice country house',
			filepath: './tests/fixtures/images/notes/0.png',
		}),
		img({
			altText: 'a city scape',
			filepath: './tests/fixtures/images/notes/1.png',
		}),
		img({
			altText: 'a sunrise',
			filepath: './tests/fixtures/images/notes/2.png',
		}),
		img({
			altText: 'a group of friends',
			filepath: './tests/fixtures/images/notes/3.png',
		}),
		img({
			altText: 'friends being inclusive of someone who looks lonely',
			filepath: './tests/fixtures/images/notes/4.png',
		}),
		img({
			altText: 'an illustration of a hot air balloon',
			filepath: './tests/fixtures/images/notes/5.png',
		}),
		img({
			altText:
				'an office full of laptops and other office equipment that look like it was abandond in a rush out of the building in an emergency years ago.',
			filepath: './tests/fixtures/images/notes/6.png',
		}),
		img({
			altText: 'a rusty lock',
			filepath: './tests/fixtures/images/notes/7.png',
		}),
		img({
			altText: 'something very happy in nature',
			filepath: './tests/fixtures/images/notes/8.png',
		}),
		img({
			altText: `someone at the end of a cry session who's starting to feel a little better.`,
			filepath: './tests/fixtures/images/notes/9.png',
		}),
	])

	return noteImages
}

export async function insertNewUser({
	username,
	password,
	email,
}: { username?: string; password?: string; email?: string } = {}) {
	const userData = createUser()
	username ??= userData.username
	password ??= userData.username
	email ??= userData.email
	const user = await prisma.user.create({
		select: { id: true, name: true, username: true, email: true },
		data: {
			...userData,
			email,
			username,
			roles: { connect: { name: 'user' } },
			password: { create: { hash: await getPasswordHash(password) } },
		},
	})
	return user as typeof user & { name: string }
}

let userImages: Array<Awaited<ReturnType<typeof img>>> | undefined
export async function getUserImages() {
	if (userImages) return userImages

	userImages = await Promise.all(
		Array.from({ length: 10 }, (_, index) =>
			img({ filepath: `./tests/fixtures/images/user/${index}.jpg` }),
		),
	)

	return userImages
}

export async function img({
	altText,
	filepath,
}: {
	altText?: string
	filepath: string
}) {
	return {
		altText,
		contentType: filepath.endsWith('.png') ? 'image/png' : 'image/jpeg',
		blob: await fs.promises.readFile(filepath),
	}
}
