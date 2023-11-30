import { Link, useLoaderData } from '@remix-run/react'
import { db } from '#app/utils/db.server'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { invariantResponse } from '#app/utils/misc'

export async function loader({ params }: DataFunctionArgs) {
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

export default function UserProfileRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="container mb-48 mt-36">
			<h1 className="text-h1">{data.user.name ?? data.user.username}</h1>
			<Link to="notes" className="underline">
				Notes
			</Link>
		</div>
	)
}
