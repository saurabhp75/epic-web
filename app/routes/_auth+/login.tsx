import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	type MetaFunction,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useActionData, useSearchParams } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { CheckboxField, ErrorList, Field } from '#app/components/forms'
import { Spacer } from '#app/components/spacer'
import { StatusButton } from '#app/components/ui/status-button'
import { validateCSRF } from '#app/utils/csrf.server'
import { checkHoneypot } from '#app/utils/honeypot.server'
import { combineResponseInits, invariant, useIsPending } from '#app/utils/misc'
import { PasswordSchema, UsernameSchema } from '#app/utils/user-validation'
import { sessionStorage } from '#app/utils/session.server'
import { login, requireAnonymous, sessionKey } from '#app/utils/auth.server'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { getRedirectToUrl, type VerifyFunctionArgs } from './verify'
import { verifySessionStorage } from '#app/utils/verification.server'
import { prisma } from '#app/utils/db.server'
import { redirectWithToast } from '#app/utils/toast.server'
import { twoFAVerificationType } from '../settings+/profile.two-factor'
// import { generateTOTP } from '@epic-web/totp'
import * as E from '@react-email/components'
import { ProviderConnectionForm } from '#app/utils/connections'

const verifiedTimeKey = 'verified-time'
const unverifiedSessionIdKey = 'unverified-session-id'
const rememberKey = 'remember-me'

// you can export a handleNewSession function here, you'll get its contents
// from the action below.
// it should take a request, session, redirectTo, and remember
export async function handleNewSession(
	{
		request,
		session,
		redirectTo,
		remember = false,
	}: {
		request: Request
		session: { userId: string; id: string; expirationDate: Date }
		redirectTo?: string
		remember?: boolean
	},
	responseInit?: ResponseInit,
) {
	if (await shouldRequestTwoFA({ request, userId: session.userId })) {
		const verifySession = await verifySessionStorage.getSession()
		verifySession.set(unverifiedSessionIdKey, session.id)
		verifySession.set(rememberKey, remember)

		// get verification details from db
		// get otp from verification details and log it (remove it in prod)
		// const twoFactorVerification = await prisma.verification.findUnique({
		// 	select: { secret: true, algorithm: true, digits: true, period: true },
		// 	where: {
		// 		target_type: { type: twoFAVerificationType, target: session.userId },
		// 	},
		// })
		// Send otp to the user
		// const { otp } = generateTOTP({ ...twoFactorVerification })
		// console.log({ otp })

		const redirectUrl = getRedirectToUrl({
			request,
			type: twoFAVerificationType,
			target: session.userId,
		})
		return redirect(
			// redirectUrl.toString(),
			`${redirectUrl.pathname}?${redirectUrl.searchParams}`,
			combineResponseInits(
				{
					headers: {
						'set-cookie':
							await verifySessionStorage.commitSession(verifySession),
					},
				},
				responseInit,
			),
		)
	} else {
		const cookieSession = await sessionStorage.getSession(
			request.headers.get('cookie'),
		)
		cookieSession.set(sessionKey, session.id)

		return redirect(
			safeRedirect(redirectTo),
			combineResponseInits(
				{
					headers: {
						'set-cookie': await sessionStorage.commitSession(cookieSession, {
							expires: remember ? session.expirationDate : undefined,
						}),
					},
				},
				responseInit,
			),
		)
	}
}

export async function handleVerification({
	request,
	submission,
}: VerifyFunctionArgs) {
	invariant(submission.value, 'Submission should have a value by this point')

	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)

	const remember = verifySession.get(rememberKey)
	const { redirectTo } = submission.value
	const headers = new Headers()

	// you're going to need to move things around a bit now. We need to handle
	// the case where we're just re-verifying an existing session rather than
	// handling a new one. So here's what you need to do:
	// add a verified time (Date.now()) to the cookie session
	cookieSession.set(verifiedTimeKey, Date.now())

	// get the unverifiedSessionId from the verifySession
	const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey)

	if (unverifiedSessionId) {
		const session = await prisma.session.findUnique({
			select: { expirationDate: true },
			where: { id: verifySession.get(unverifiedSessionIdKey) },
		})
		if (!session) {
			throw await redirectWithToast('/login', {
				type: 'error',
				title: 'Invalid session',
				description: 'Could not find session to verify. Please try again.',
			})
		}

		cookieSession.set(sessionKey, verifySession.get(unverifiedSessionIdKey))

		headers.append(
			'set-cookie',
			await sessionStorage.commitSession(cookieSession, {
				expires: remember ? session.expirationDate : undefined,
			}),
		)
	} else {
		headers.append(
			// we just want to commit the cookie session
			// so we can add the verified time to the cookie
			'set-cookie',
			await sessionStorage.commitSession(cookieSession),
		)
	}

	// the rest of this is unchanged.
	headers.append(
		'set-cookie',
		await verifySessionStorage.destroySession(verifySession),
	)

	return redirect(safeRedirect(redirectTo), { headers })
}

export async function shouldRequestTwoFA({
	request,
	userId,
}: {
	request: Request
	userId: string
}) {
	// get the verify session
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)

	// if there's currently an unverifiedSessionId, return true
	if (verifySession.has(unverifiedSessionIdKey)) return true

	// if it's over two hours since they last verified, we should request 2FA again
	// get the 2fa verification and return false if there is none
	const userHasTwoFA = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { target: userId, type: twoFAVerificationType } },
	})
	if (!userHasTwoFA) return false

	// get the cookieSession from sessionStorage
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)

	// get the verifiedTime from the cookieSession
	const verifiedTime = cookieSession.get(verifiedTimeKey) ?? new Date(0)

	// return true if the verifiedTime is over two hours ago
	const twoHours = 1000 * 60 * 60 * 2
	return Date.now() - verifiedTime > twoHours
}

const LoginFormSchema = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	redirectTo: z.string().optional(),
	remember: z.boolean().optional(),
})

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAnonymous(request)
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	checkHoneypot(formData)

	const submission = await parse(formData, {
		schema: intent =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== 'submit') return { ...data, session: null }

				const session = await login(data)
				if (!session) {
					ctx.addIssue({
						code: 'custom',
						message: 'Invalid username or password',
					})
					return z.NEVER
				}
				return { ...data, session }
			}),
		async: true,
	})

	// get the password off the payload that's sent back
	delete submission.payload.password

	if (submission.intent !== 'submit') {
		// @ts-expect-error - conform should probably have support for doing this
		delete submission.value?.password
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value?.session) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	// get the user from the submission.value
	const { session, remember, redirectTo } = submission.value

	return handleNewSession({ request, session, remember, redirectTo })
}

export function LoginEmail({ otp }: { otp: string }) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>OTP for Epic Notes login</E.Text>
				</h1>
				<p>
					<E.Text>
						Here's your verification code: <strong>{otp}</strong>
					</E.Text>
				</p>
			</E.Container>
		</E.Html>
	)
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'login-form',
		constraint: getFieldsetConstraint(LoginFormSchema),
		defaultValue: { redirectTo },
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-md">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome back!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Spacer size="xs" />

				<div>
					<div className="mx-auto w-full max-w-md px-8">
						<Form method="POST" {...form.props}>
							<AuthenticityTokenInput />
							<HoneypotInputs />
							<Field
								labelProps={{ children: 'Username' }}
								inputProps={{
									...conform.input(fields.username),
									autoFocus: true,
									className: 'lowercase',
								}}
								errors={fields.username.errors}
							/>

							<Field
								labelProps={{ children: 'Password' }}
								inputProps={conform.input(fields.password, {
									type: 'password',
								})}
								errors={fields.password.errors}
							/>

							<div className="flex justify-between">
								<CheckboxField
									labelProps={{
										htmlFor: fields.remember.id,
										children: 'Remember me',
									}}
									buttonProps={conform.input(fields.remember, {
										type: 'checkbox',
									})}
									errors={fields.remember.errors}
								/>
								<div>
									<Link
										to="/forgot-password"
										className="text-body-xs font-semibold"
									>
										Forgot password?
									</Link>
								</div>
							</div>

							<input
								{...conform.input(fields.redirectTo, { type: 'hidden' })}
							/>

							<ErrorList errors={form.errors} id={form.errorId} />

							<div className="flex items-center justify-between gap-6 pt-3">
								<StatusButton
									className="w-full"
									status={isPending ? 'pending' : actionData?.status ?? 'idle'}
									type="submit"
									disabled={isPending}
								>
									Log in
								</StatusButton>
							</div>
						</Form>
						<div className="mt-5 flex flex-col gap-5 border-b-2 border-t-2 border-border py-3">
							<ProviderConnectionForm
								type="Login"
								providerName="github"
								redirectTo={redirectTo}
							/>
						</div>
						<div className="flex items-center justify-center gap-2 pt-6">
							<span className="text-muted-foreground">New here?</span>
							<Link
								to={
									redirectTo
										? `/signup?${encodeURIComponent(redirectTo)}`
										: '/signup'
								}
							>
								Create an account
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Login to Epic Notes' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
