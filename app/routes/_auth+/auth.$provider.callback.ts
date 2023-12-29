import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import {
	authenticator,
	getSessionExpirationDate,
	getUserId,
} from '#app/utils/auth.server'
import { ProviderNameSchema, providerLabels } from '#app/utils/connections'
import { createToastHeaders, redirectWithToast } from '#app/utils/toast.server'
import { prisma } from '#app/utils/db.server'
import { handleNewSession } from './login'
import { combineHeaders, combineResponseInits } from '#app/utils/misc'
import {
	destroyRedirectToHeader,
	getRedirectCookieValue,
} from '#app/utils/redirect-cookie.server'
import {
	onboardingEmailSessionKey,
	prefilledProfileKey,
	providerIdKey,
} from './onboarding_.$provider'
import { verifySessionStorage } from '#app/utils/verification.server'

const destroyRedirectTo = { 'set-cookie': destroyRedirectToHeader }

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)
	const redirectTo = getRedirectCookieValue(request)

	const label = providerLabels[providerName]

	const profile = await authenticator
		.authenticate(providerName, request, { throwOnError: true })
		.catch(async error => {
			console.error(error)
			throw await redirectWithToast(
				'/login',
				{
					title: 'Auth Failed',
					description: `There was an error authenticating with ${label}.`,
					type: 'error',
				},
				{ headers: destroyRedirectTo },
			)
		})

	// handle the error thrown by logging the error and redirecting the user
	// to the login page with a toast message indicating that there was an error
	// authenticating with the provider.

	// console.log({ profile })

	// check db for an existing connection
	// via the providerName and providerId (profile.id) and select the userId
	const existingConnection = await prisma.connection.findUnique({
		select: { userId: true },
		where: {
			providerName_providerId: { providerName, providerId: profile.id },
		},
	})

	const userId = await getUserId(request)

	// if there's an existing connection and a userId, then there's a conflict... Either:
	// 1. The account is already connected to their own account
	// 2. The account is already connected to someone else's account
	// redirect to /settings/profile/connections with apprpropriate toast message
	if (existingConnection && userId) {
		return await redirectWithToast(
			'/settings/profile/connections',
			{
				title: 'Already Connected',
				description:
					existingConnection.userId === userId
						? `Your "${profile.username}" ${label} account is already connected.`
						: `The "${profile.username}" ${label} account is already connected to another account.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// If there's a userId, then they're trying to connect, so create a connection
	// for the currently logged in user and give them a toast message letting them
	// know it worked.
	// If we're already logged in, then link the account
	if (userId) {
		await prisma.connection.create({
			data: { providerName, providerId: profile.id, userId },
		})
		return await redirectWithToast(
			'/settings/profile/connections',
			{
				title: 'Connected',
				type: 'success',
				description: `Your "${profile.username}" ${label} account has been connected.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// if there's an existing connection, then the user is trying to login.
	// create a new session for the existingConnection.userId
	// once you've updated login to export handleNewSession, return a call to it here.
	if (existingConnection) {
		return makeSession({
			request,
			userId: existingConnection.userId,
			redirectTo,
		})
	}

	// find a user by the profile.email and if a user exists, then create a
	// new connection for that user and return a call to makeSession
	// redirect them to '/settings/profile/connections'
	// use `createToastHeaders` to add a header to create a toast message:
	// {
	// 	title: 'Connected',
	// 	description: `Your "${profile.username}" ${label} account has been connected.`,
	// }
	// if the email matches a user in the db, then link the account and
	// make a new session
	const user = await prisma.user.findUnique({
		select: { id: true },
		where: { email: profile.email.toLowerCase() },
	})
	if (user) {
		await prisma.connection.create({
			data: { providerName, providerId: profile.id, userId: user.id },
		})
		return makeSession(
			{
				request,
				userId: user.id,
				// send them to the connections page to see their new connection
				redirectTo: redirectTo ?? '/settings/profile/connections',
			},
			{
				headers: await createToastHeaders({
					title: 'Connected',
					description: `Your "${profile.username}" ${label} account has been connected.`,
				}),
			},
		)
	}

	// get the verifySession here from verifySessionStorage.getSession
	// set the onboardingEmailSessionKey to the profile.email
	// set the prefilledProfileKey to the profile (you'll need to create this in the onboarding_.$provider route)
	// as extra credit, make sure the username matches our rules:
	// 1. only alphanumeric characters
	// 2. lowercase
	// 3. 3-20 characters long
	// you can replace invalid characters with "_"
	// set the providerIdKey to the profile.id
	// return a redirect to `/onboarding/${providerName}` and commit the verify session storage
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	verifySession.set(onboardingEmailSessionKey, profile.email)
	verifySession.set(prefilledProfileKey, {
		...profile,
		username: profile.username
			?.replace(/[^a-zA-Z0-9_]/g, '_')
			.toLowerCase()
			.slice(0, 20)
			.padEnd(3, '_'),
	})
	verifySession.set(providerIdKey, profile.id)
	const onboardingRedirect = [
		`/onboarding/${providerName}`,
		redirectTo ? new URLSearchParams({ redirectTo }) : null,
	]
		.filter(Boolean)
		.join('?')
	return redirect(onboardingRedirect, {
		headers: combineHeaders(
			{ 'set-cookie': await verifySessionStorage.commitSession(verifySession) },
			destroyRedirectTo,
		),
	})
}

async function makeSession(
	{
		request,
		userId,
		redirectTo,
	}: { request: Request; userId: string; redirectTo?: string | null },
	responseInit?: ResponseInit,
) {
	redirectTo ??= '/'
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
	})
	return handleNewSession(
		{ request, session, redirectTo, remember: true },
		combineResponseInits({ headers: destroyRedirectTo }, responseInit),
	)
}
