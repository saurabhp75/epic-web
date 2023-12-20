import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import {
	authenticator,
	getSessionExpirationDate,
	getUserId,
} from '#app/utils/auth.server'
import { ProviderNameSchema, providerLabels } from '#app/utils/connections'
import { redirectWithToast } from '#app/utils/toast.server'
import { prisma } from '#app/utils/db.server'
import { handleNewSession } from './login'
import {
	onboardingEmailSessionKey,
	prefilledProfileKey,
	providerIdKey,
} from './onboarding_.$provider'
import { verifySessionStorage } from '#app/utils/verification.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	const label = providerLabels[providerName]

	const profile = await authenticator
		.authenticate(providerName, request, {
			throwOnError: true,
		})
		.catch(async error => {
			console.error(error)
			throw await redirectWithToast('/login', {
				type: 'error',
				title: 'Auth Failed',
				description: `There was an error authenticating with ${label}.`,
			})
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
		throw await redirectWithToast('/settings/profile/connections', {
			title: 'Already Connected',
			description:
				existingConnection.userId === userId
					? `Your "${profile.username}" ${label} account is already connected.`
					: `The "${profile.username}" ${label} account is already connected to another account.`,
		})
	}

	// if there's an existing connection, then the user is trying to login.
	// create a new session for the existingConnection.userId
	// once you've updated login to export handleNewSession, return a call to it here.
	if (existingConnection) {
		const session = await prisma.session.create({
			select: { id: true, expirationDate: true, userId: true },
			data: {
				expirationDate: getSessionExpirationDate(),
				userId: existingConnection.userId,
			},
		})
		return handleNewSession({ request, session, remember: true })
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
	return redirect(`/onboarding/${providerName}`, {
		headers: {
			'set-cookie': await verifySessionStorage.commitSession(verifySession),
		},
	})
}
