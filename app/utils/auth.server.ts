import { type User, type Password } from '@prisma/client'
import { redirect } from '@remix-run/node'
import bcrypt from 'bcryptjs'
import { prisma } from './db.server'
import { combineResponseInits } from './misc'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { sessionStorage } from './session.server'

export { bcrypt }

// 🐨 create a SESSION_EXPIRATION_TIME variable here
// 🐨 export a simple function that returns a new date that's the current time plus the SESSION_EXPIRATION_TIME
const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () =>
	new Date(Date.now() + SESSION_EXPIRATION_TIME)

export const userIdKey = 'userId'

export async function getUserId(request: Request) {
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const userId = cookieSession.get(userIdKey)
	if (!userId) return null
	const user = await prisma.user.findUnique({
		select: { id: true },
		where: { id: userId },
	})
	if (!user) {
		throw await logout({ request })
	}
	return user.id
}

// 🐨 create a function called `requireAnonymous` here that takes a request
// 🐨 get the user's Id from the session using getUserId
// 🐨 if there's a userId, then throw a redirect to '/' (otherwise do nothing)

export async function login({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	return verifyUserPassword({ username }, password)
}

export async function signup({
	email,
	username,
	password,
	name,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)

	const user = await prisma.user.create({
		select: { id: true },
		data: {
			email: email.toLowerCase(),
			username: username.toLowerCase(),
			name,
			roles: { connect: { name: 'user' } },
			password: {
				create: {
					hash: hashedPassword,
				},
			},
		},
	})

	return user
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)
	throw redirect(
		safeRedirect(redirectTo),
		combineResponseInits(responseInit, {
			headers: {
				'set-cookie': await sessionStorage.destroySession(cookieSession),
			},
		}),
	)
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: { id: true, password: { select: { hash: true } } },
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}

// If the user doesn't exist, log the user out with the logout utility.
// TypeScript is happiest when you do: "throw await logout({ request })"
// If the user does exist, then return the user.
export async function requireUser(request: Request) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		select: { id: true, username: true },
		where: { id: userId },
	})
	if (!user) {
		// user found in cookie but not
		// in db, so logout
		throw await logout({ request })
	}
	return user
}

// get the user's Id from the session using getUserId
// if there's a userId, then throw a redirect to '/' (otherwise do nothing)
export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)
	if (userId) {
		throw redirect('/')
	}
}

// returns the userId if it exists and throws a redirect to the login page
// if no userId exists in the session.
export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const userId = await getUserId(request)
	if (!userId) {
		// 🐨 create a URL object with new URL(request.url)
		// 🐨 if redirectTo was passed as an argument we'll just use that, otherwise
		// 🐨 create the path to redirectTo by combining the url's pathname and search
		// 🐨 construct the login redirect path so it ends up being something like
		// this: '/login?redirectTo=/protected/path'
		// 💯 don't include the redirectTo if it's null
		// 🐨 update this redirect to use your loginRedirect
		const requestUrl = new URL(request.url)
		redirectTo =
			redirectTo === null
				? null
				: redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
		const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
		const loginRedirect = ['/login', loginParams?.toString()]
			.filter(Boolean)
			.join('?')
		throw redirect(loginRedirect)
	}
	return userId
}
