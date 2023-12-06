import { requireUser } from '#app/utils/auth.server'
import { invariantResponse } from '#app/utils/misc'
import { type DataFunctionArgs } from '@remix-run/node'
import { json } from 'express'
import { action, NoteEditor } from './__note-editor'

export async function loader({ request, params }: DataFunctionArgs) {
	const user = await requireUser(request)
	invariantResponse(user.username === params.username, 'Not authorized', {
		status: 403,
	})
	return json({})
}
export { action }
export default NoteEditor
