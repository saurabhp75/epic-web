import { requireUser } from '#app/utils/auth.server'
import { invariantResponse } from '#app/utils/misc'
import { type LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { action, NoteEditor } from './__note-editor'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const user = await requireUser(request)
	invariantResponse(user.username === params.username, 'Not authorized', {
		status: 403,
	})
	return json({})
}
export { action }
export default NoteEditor
