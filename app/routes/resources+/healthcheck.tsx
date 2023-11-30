// A resource route doesn't have default
// export for the UI

export async function loader() {
	return new Response('OK')
}
