import os from 'node:os'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	json,
	type MetaFunction,
	type LinksFunction,
	type DataFunctionArgs,
	redirect,
} from '@remix-run/node'
import {
	// Form,
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useFetcher,
	useFetchers,
	useLoaderData,
	// useLocation,
	useMatches,
	// useSubmit,
} from '@remix-run/react'

import faviconAssetUrl from './assets/favicon.svg'
import fontStylesheetUrl from './styles/font.css'
import tailwindStylesheetUrl from './styles/tailwind.css'
import { getEnv } from './utils/env.server'
import { GeneralErrorBoundary } from './components/error-boundary'
import { honeypot } from './utils/honeypot.server'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { csrf } from './utils/csrf.server'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { SearchBar } from './components/search-bar'
import { Button } from './components/ui/button'
import { getTheme, setTheme, type Theme } from './utils/theme.server'
import { useForm } from '@conform-to/react'
import { ErrorList } from './components/forms'
import { Icon } from './components/ui/icon'
import { Spacer } from './components/spacer'
import { Toaster, toast as showToast } from 'sonner'
import { z } from 'zod'
import { combineHeaders, getUserImgSrc, invariantResponse } from './utils/misc'
import { parse } from '@conform-to/zod'
import { useEffect } from 'react'
import type { Toast } from './utils/toast.server'
import { getToast } from './utils/toast.server'
import { prisma } from './utils/db.server'
import { sessionStorage } from './utils/session.server'
import { useOptionalUser } from './utils/user'

// import {
// 	AlertDialog,
// 	AlertDialogAction,
// 	AlertDialogCancel,
// 	AlertDialogContent,
// 	AlertDialogDescription,
// 	AlertDialogFooter,
// 	AlertDialogHeader,
// 	AlertDialogTitle,
// } from './components/ui/alert-dialog'

// Commented out as it was just to demo Remix Bundling
// import './styles/global.css'

// By default Remix takes the "favicon.ico" from "/public'
// folder, we can change this using links export

export const links: LinksFunction = () => {
	return [
		{
			type: 'image/svg+xml',
			href: faviconAssetUrl,
			rel: 'icon',
		},
		{ rel: 'stylesheet', href: fontStylesheetUrl },
		{ rel: 'stylesheet', href: tailwindStylesheetUrl },
		cssBundleHref ? { rel: 'stylesheet', href: cssBundleHref } : null,
	].filter(Boolean) // Keep TS happy
}

export const meta: MetaFunction = () => {
	return [
		{ title: 'Epic Notes' },
		{ name: 'description', content: `Your own captain's log` },
	]
}

export async function loader({ request }: DataFunctionArgs) {
	// The two returns below are exactly same, json() is a
	// handy utility for sending responses
	// return json({ hello: 'world' })
	// return new Response(JSON.stringify({ hello: 'world' }), {
	// 	headers: { 'content-type': 'application/json' },
	// })

	const honeyProps = honeypot.getInputProps()
	// 🐨 get the csrfToken and csrfCookieHeader from csrf.commitToken
	// 🐨 add the csrfToken to this object
	// 🐨 add a 'set-cookie' header to the response with the csrfCookieHeader
	const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request)

	// 🐨 get the toastCookieSession using the toastSessionStorage.getSession
	// 🐨 get the 'toast' from the toastCookieSession
	const { toast, headers: toastHeaders } = await getToast(request)

	// 🐨 get the cookie header from the request
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)

	// 🐨 get the userId from the cookie session
	const userId = cookieSession.get('userId')

	// 🐨 if there's a userId, then get the user from the database
	// 💰 you will want to specify a select. You'll need the id, username, name,
	// and image's id
	const user = userId
		? await prisma.user.findUnique({
				select: {
					id: true,
					name: true,
					username: true,
					image: { select: { id: true } },
				},
				where: { id: userId },
		  })
		: null

	// 🐨 if there's a userId but no user then something's wrong.
	// Let's delete destroy the session and redirect to the home page.
	if (userId && !user) {
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		throw redirect('/', {
			headers: {
				'set-cookie': await sessionStorage.destroySession(cookieSession),
			},
		})
	}

	return json(
		{
			username: os.userInfo().username,
			// 🐨 add the user here (if there was no userId then the user can be null)
			// 💰 don't forget to update the component below to access the user from the data.
			user,
			theme: getTheme(request),
			toast,
			ENV: getEnv(),
			honeyProps,
			csrfToken,
		},
		{
			// 🐨  "combineHeaders" combine 'set-cookie' headers for toast
			// and csrf related cookies
			headers: combineHeaders(
				csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : null,
				toastHeaders,
			),
		},
	)
}

const ThemeFormSchema = z.object({
	theme: z.enum(['light', 'dark']),
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	invariantResponse(
		formData.get('intent') === 'update-theme',
		'Invalid intent',
		{ status: 400 },
	)
	const submission = parse(formData, {
		schema: ThemeFormSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'success', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	// 🐨 get the theme from the submission.value
	// 🐨 get the value of the cookie header by calling setTheme with the theme
	const { theme } = submission.value

	// 🐨 Uncomment the console.log to test things out:
	// console.log(submission.value)

	const responseInit = {
		headers: {
			// 🐨 add a 'set-cookie' header to this response and set it to the
			// serialized cookie:
			'set-cookie': setTheme(theme),
		},
	}
	return json({ success: true, submission }, responseInit)
}

function App() {
	// throw new Error('🐨 Loader error')
	const data = useLoaderData<typeof loader>()
	const theme = useTheme()
	const user = useOptionalUser()
	const matches = useMatches()
	const isOnSearchPage = matches.find(m => m.id === 'routes/users+/index')

	return (
		<Document theme={theme} env={data.ENV}>
			<header className="container px-6 py-4 sm:px-8 sm:py-6">
				<nav className="flex items-center justify-between gap-4 sm:gap-6">
					<Link to="/">
						<div className="font-light">epic</div>
						<div className="font-bold">notes</div>
					</Link>
					{isOnSearchPage ? null : (
						<div className="ml-auto max-w-sm flex-1">
							<SearchBar status="idle" />
						</div>
					)}
					<div className="flex items-center gap-10">
						{user ? (
							<div className="flex items-center gap-2">
								<Button asChild variant="secondary">
									<Link
										to={`/users/${user.username}`}
										className="flex items-center gap-2"
									>
										<img
											className="h-8 w-8 rounded-full object-cover"
											alt={user.name ?? user.username}
											src={getUserImgSrc(user.image?.id)}
										/>
										<span className="hidden text-body-sm font-bold sm:block">
											{user.name ?? user.username}
										</span>
									</Link>
								</Button>
							</div>
						) : (
							<Button asChild variant="default" size="sm">
								<Link to="/login">Log In</Link>
							</Button>
						)}
					</div>
				</nav>
			</header>

			<div className="flex-1">
				<Outlet />
			</div>

			<div className="container mx-auto flex justify-between">
				<Link to="/">
					<div className="font-light">epic</div>
					<div className="font-bold">notes</div>
				</Link>
				<div className="flex items-center gap-2">
					<p>Built with ♥️ by {data.username}</p>
					<ThemeSwitch userPreference={theme} />
				</div>
			</div>
			<Spacer size="3xs" />
			{data.toast ? <ShowToast toast={data.toast} /> : null}
		</Document>
	)
}

// useTheme hook reads the current theme from useLoaderData
// and returns it unless there's an ongoing fetcher setting the theme.
// 🦉 The ThemeSwitch is using useFetcher to make the switch.
// 💰 Add a `.find` on the fetchers array to find the fetcher which has formData
// with an intent of 'update-theme'. If that fetcher is found, then return the
// 'theme' from the fetcher's formData.
function useTheme() {
	const data = useLoaderData<typeof loader>()
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(
		f => f.formData?.get('intent') === 'update-theme',
	)
	// Get the value submitted by the user
	const optimisticTheme = themeFetcher?.formData?.get('theme')
	if (optimisticTheme === 'light' || optimisticTheme === 'dark') {
		return optimisticTheme
	}
	// Fallback to server provided value
	return data.theme
}

export default function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<HoneypotProvider {...data.honeyProps}>
			<AuthenticityTokenProvider token={data.csrfToken}>
				<App />
			</AuthenticityTokenProvider>
		</HoneypotProvider>
	)
}

function Document({
	children,
	theme,
	env,
} // isLoggedIn = false,
: {
	children: React.ReactNode
	theme?: Theme
	env?: Record<string, string>
	// isLoggedIn?: boolean
}) {
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="flex h-full flex-col justify-between bg-background text-foreground">
				{children}
				{/*
				🐨 Inline script here using dangerouslySetInnerHTML which
				sets window.ENV to the JSON.stringified value of data.ENV
			*/}
				<script
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				{/* {isLoggedIn ? <LogoutTimer /> : null} */}
				<Toaster closeButton position="top-center" />
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
}

function ThemeSwitch({ userPreference }: { userPreference?: Theme }) {
	const fetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: 'theme-switch',
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ThemeFormSchema })
		},
	})

	const mode = userPreference ?? 'light'
	// 🐨 set the nextMode to the opposite of the current mode
	const nextMode = mode === 'light' ? 'dark' : 'light'
	const modeLabel = {
		light: (
			<Icon name="sun">
				<span className="sr-only">Light</span>
			</Icon>
		),
		dark: (
			<Icon name="moon">
				<span className="sr-only">Dark</span>
			</Icon>
		),
	}

	return (
		<fetcher.Form method="POST" {...form.props}>
			<input type="hidden" name="theme" value={nextMode} />
			<div className="flex gap-2">
				<button
					name="intent"
					value="update-theme"
					type="submit"
					className="flex h-8 w-8 cursor-pointer items-center justify-center"
				>
					{modeLabel[mode]}
				</button>
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
		</fetcher.Form>
	)
}

/* // Disable autologout for now
// 💣 you can remove this eslint line once you've rendered the LogoutTimer
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LogoutTimer() {
	const [status, setStatus] = useState<'idle' | 'show-modal'>('idle')
	// 🐨 bring in the location via useLocation so we can access location.key
	// 🐨 get a submit function via useSubmit
	// 🦉 normally you'd want these numbers to be much higher, but for the purpose
	// of this exercise, we'll make it short:
	const location = useLocation()
	const submit = useSubmit()
	const logoutTime = 5000
	const modalTime = 2000
	// 🦉 here's what would be more likely:
	// const logoutTime = 1000 * 60 * 60;
	// const modalTime = logoutTime - 1000 * 60 * 2;
	const modalTimer = useRef<ReturnType<typeof setTimeout>>()
	const logoutTimer = useRef<ReturnType<typeof setTimeout>>()

	const logout = useCallback(() => {
		// 🐨 call submit in here. The submit body can be null,
		// but the requestInit should be method POST and action '/logout'
		submit(null, { method: 'POST', action: '/logout' })
	}, [submit])

	const cleanupTimers = useCallback(() => {
		clearTimeout(modalTimer.current)
		clearTimeout(logoutTimer.current)
	}, [])

	const resetTimers = useCallback(() => {
		cleanupTimers()
		modalTimer.current = setTimeout(() => {
			setStatus('show-modal')
		}, modalTime)
		logoutTimer.current = setTimeout(logout, logoutTime)
	}, [cleanupTimers, logout, logoutTime, modalTime])

	// 🐨 whenever the location changes, we want to reset the timers, so you
	// can add location.key to this array:
	useEffect(() => resetTimers(), [resetTimers, location.key])
	useEffect(() => cleanupTimers, [cleanupTimers])

	function closeModal() {
		setStatus('idle')
		resetTimers()
	}

	return (
		<AlertDialog
			aria-label="Pending Logout Notification"
			open={status === 'show-modal'}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you still there?</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription>
					You are going to be logged out due to inactivity. Close this modal to
					stay logged in.
				</AlertDialogDescription>
				<AlertDialogFooter className="flex items-end gap-8">
					<AlertDialogCancel onClick={closeModal}>
						Remain Logged In
					</AlertDialogCancel>
					<Form method="POST" action="/logout">
						<AlertDialogAction type="submit">Logout</AlertDialogAction>
					</Form>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
*/

function ShowToast({ toast }: { toast: Toast }) {
	const { id, type, title, description } = toast
	useEffect(() => {
		setTimeout(() => {
			showToast[type](title, { id, description })
		}, 0)
	}, [description, id, title, type])
	return null
}

export function ErrorBoundary() {
	return (
		<Document>
			<div className="flex-1">
				<GeneralErrorBoundary />
			</div>
		</Document>
	)
}
