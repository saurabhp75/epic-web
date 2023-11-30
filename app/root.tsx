import { type LinksFunction } from '@remix-run/node'
import { Links, LiveReload, Scripts } from '@remix-run/react'

import faviconAssetUrl from './assets/favicon.svg'
import fontStylesheetUrl from './styles/font.css'

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
	]
}

export default function App() {
	return (
		<html lang="en">
			<head>
				<Links />
			</head>
			<body>
				<p>Hello World</p>
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
}
