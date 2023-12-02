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

// Commented out as it was just to demo Remix Bundling
// import './styles/global.css'

// By default Remix takes the "favicon.ico" from "/public'
// folder, we can change this usings the links export

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
	// The two return below are exactly same, json() is a
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

function App() {
	// throw new Error('🐨 Loader error')

	const data = useLoaderData<typeof loader>()

	return (
		<Document>
			<header className="container mx-auto py-6">
				<nav className="flex justify-between">
					<Link to="/">
						<div className="font-light">epic</div>
						<div className="font-bold">notes</div>
					</Link>
					<Link className="underline" to="/signup">
						Signup
					</Link>
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
				<p>Built with ♥️ by {data.username}</p>
			</div>
			<div className="h-5" />
			{/*
				🐨 add an inline script here using dangerouslySetInnerHTML which
				sets window.ENV to the JSON.stringified value of data.ENV
			*/}
			<script
				dangerouslySetInnerHTML={{
					__html: `window.ENV = ${JSON.stringify(data.ENV)}`,
				}}
			/>
		</Document>
	)
}

export default function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<AuthenticityTokenProvider token={data.csrfToken}>
			<HoneypotProvider {...data.honeyProps}>
				<App />
			</HoneypotProvider>
		</AuthenticityTokenProvider>
	)
}

function Document({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full overflow-x-hidden">
			<head>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="flex h-full flex-col justify-between bg-background text-foreground">
				{children}
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
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
