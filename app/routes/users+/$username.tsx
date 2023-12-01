import {
	Link,
	useLoaderData,
} from '@remix-run/react'
import { db } from '#app/utils/db.server'
import { json, type DataFunctionArgs, type MetaFunction } from '@remix-run/node'
import { invariantResponse } from '#app/utils/misc'
import { GeneralErrorBoundary } from '#app/components/error-boundary'

export async function loader({ params }: DataFunctionArgs) {
	// Below error will be caught by error boundary
	// throw new Error('🐨 Loader error')

	const user = db.user.findFirst({
		where: {
			username: {
				equals: params.username,
			},
		},
	})

	// Replaced by invariantResponse() utility
	// if (!user) {
	// 	throw new Response('user not found', { status: 404 })
	// }

	invariantResponse(user, 'user not found', { status: 404 })

	return json({
		user: { name: user.name, username: user.username },
	})
}

export default function ProfileRoute() {
	// Below error will be caught by error boundary
	// throw new Error('🐨 Loader error')

	const data = useLoaderData<typeof loader>()

	return (
		<div className="container mb-48 mt-36">
			<h1 className="text-h1">{data.user.name ?? data.user.username}</h1>
			<Link to="notes" className="underline" prefetch="intent">
				Notes
			</Link>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.name ?? params.username
	return [
		{ title: `${displayName} | Epic Notes` },
		{ name: 'description', content: `Profile of ${displayName} on Epic Notes` },
	]
}

// Error boundary doesn't catch errors thrown in
// event handlers, timeout callbacks. But it catches
// errors in useEffect as it is in React's control
export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}
