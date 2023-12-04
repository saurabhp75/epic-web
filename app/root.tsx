import os from 'node:os'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	json,
	type MetaFunction,
	type LinksFunction,
	type DataFunctionArgs,
} from '@remix-run/node'
import {
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useMatches,
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
import type { Theme } from './utils/theme.server'
import { useForm } from '@conform-to/react'
import { ErrorList } from './components/forms'
import { Icon } from './components/ui/icon'
import { Spacer } from './components/spacer'
import { z } from 'zod'
import { invariantResponse } from './utils/misc'
import { parse } from '@conform-to/zod'

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
	const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request)
	// 🐨 get the csrfToken and csrfCookieHeader from csrf.commitToken
	// 🐨 add the csrfToken to this object
	// 🐨 add a 'set-cookie' header to the response with the csrfCookieHeader
	return json(
		{ username: os.userInfo().username, ENV: getEnv(), honeyProps, csrfToken },
		{
			headers: csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : {},
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

	// 🐨 Uncomment the console.log to test things out:
	// console.log(submission.value)

	// we'll do stuff with the submission next...

	return json({ success: true, submission })
}

function App() {
	// throw new Error('🐨 Loader error')
	const data = useLoaderData<typeof loader>()
	const theme = 'light' // we'll handle this later
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
						<Button asChild variant="default" size="sm">
							<Link to="/login">Log In</Link>
						</Button>
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
		</Document>
	)
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
}: {
	children: React.ReactNode
	theme?: Theme
	env?: Record<string, string>
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
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
}

function ThemeSwitch({ userPreference }: { userPreference?: Theme }) {
	// 🐨 create a fetcher. 💰 The generic will be <typeof action>

	const [form] = useForm({
		id: 'theme-switch',
		// 🐨 set the lastSubmission to fetcher.data?.submission
		onValidate({ formData }) {
			return parse(formData, { schema: ThemeFormSchema })
		},
	})

	const mode = userPreference ?? 'light'
	// 🐨 set the nextMode to the opposite of the current mode
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
		// 🐨 change this to a fetcher.Form and set the method as POST
		<form {...form.props}>
			{/* 🐨 add a hidden input for the theme and set its value to nextMode */}
			<div className="flex gap-2">
				<button
					// 🐨 set the name to "intent" and the value to "update-theme"
					type="submit"
					className="flex h-8 w-8 cursor-pointer items-center justify-center"
				>
					{modeLabel[mode]}
				</button>
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
		</form>
	)
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
