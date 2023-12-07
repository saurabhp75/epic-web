import { useRouteLoaderData } from '@remix-run/react'
import { type loader as rootLoader } from '#app/root'

// 🦺 you can make this type safe by importing the root loader type like this:
// import { type loader as rootLoader } from '#app/root'
export function useOptionalUser() {
	const data = useRouteLoaderData<typeof rootLoader>('root')
	return data?.user ?? null
}

// get the root loader data and
// returns the user if it exists, otherwise return null.

export function useUser() {
	// call useOptionalUser and if the user does not exist, throw
	// an error with an informative error message. 
	// Otherwise return the user
	const maybeUser = useOptionalUser()
	if (!maybeUser) {
		throw new Error(
			'No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.',
		)
	}
	return maybeUser
}
