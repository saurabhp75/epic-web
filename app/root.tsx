import { LiveReload, Scripts } from '@remix-run/react'

export default function App() {
	return (
		<html lang="en">
			<head></head>
			<body>
				<p>Hello World!!!</p>
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
}
