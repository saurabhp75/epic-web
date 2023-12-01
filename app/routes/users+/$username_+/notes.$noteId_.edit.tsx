import { json, type DataFunctionArgs, redirect } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { db } from '#app/utils/db.server'
import { invariantResponse, useIsSubmitting } from '#app/utils/misc'
import { Label } from '@radix-ui/react-label'
import { Input } from '#app/components/ui/input'
import { Button } from '#app/components/ui/button'
import { floatingToolbarClassName } from '#app/components/floating-toolbar'
import { Textarea } from '#app/components/ui/textarea'
import { StatusButton } from '#app/components/ui/status-button'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { useEffect, useState } from 'react'

export async function loader({ params }: DataFunctionArgs) {
	const note = db.note.findFirst({
		where: {
			id: {
				equals: params.noteId,
			},
		},
	})

	invariantResponse(note, 'Note not found', { status: 404 })

	return json({
		note: { title: note.title, content: note.content },
	})
}

type ActionErrors = {
	formErrors: Array<string>
	fieldErrors: {
		title: Array<string>
		content: Array<string>
	}
}

const titleMaxLength = 100
const contentMaxLength = 10000

export async function action({ request, params }: DataFunctionArgs) {
	const formData = await request.formData()
	const title = formData.get('title')
	const content = formData.get('content')

	invariantResponse(typeof title === 'string', 'title must be a string')
	invariantResponse(typeof content === 'string', 'content must be a string')

	const errors: ActionErrors = {
		formErrors: [],
		fieldErrors: {
			title: [],
			content: [],
		},
	}

	if (title === '') {
		errors.fieldErrors.title.push('Title is required')
	}
	if (title.length > titleMaxLength) {
		errors.fieldErrors.title.push(
			`Title must be at most ${titleMaxLength} characters`,
		)
	}
	if (content === '') {
		errors.fieldErrors.content.push('Content is required')
	}
	if (content.length > contentMaxLength) {
		errors.fieldErrors.content.push(
			`Content must be at most ${contentMaxLength} characters`,
		)
	}

	const hasErrors =
		errors.formErrors.length ||
		Object.values(errors.fieldErrors).some(fieldErrors => fieldErrors.length)
	if (hasErrors) {
		return json({ status: 'error', errors } as const, { status: 400 })
	}

	db.note.update({
		where: { id: { equals: params.noteId } },
		data: { title, content },
	})

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({ errors }: { errors?: Array<string> | null }) {
	return errors?.length ? (
		<ul className="flex flex-col gap-1">
			{errors.map((error, i) => (
				<li key={i} className="text-[10px] text-foreground-destructive">
					{error}
				</li>
			))}
		</ul>
	) : null
}

function useHydrated() {
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	return hydrated
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	// 🐨 determine whether this form is submitting
	const isSubmitting = useIsSubmitting()
	// we can use useId hook for form and input field ids
	const formId = 'note-editor'

	const fieldErrors =
		actionData?.status === 'error' ? actionData.errors.fieldErrors : null
	const formErrors =
		actionData?.status === 'error' ? actionData.errors.formErrors : null

	const isHydrated = useHydrated()

	return (
		<div className="absolute inset-0">
			<Form
				id={formId}
				// Do client side html validation before JS is loaded
				// After JS loads, all validation done @ server side!!
				noValidate={isHydrated}
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
			>
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor="note-title">Title</Label>
						<Input
							id="note-title"
							name="title"
							defaultValue={data.note.title}
							required
							maxLength={titleMaxLength}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList errors={fieldErrors?.title} />
						</div>
					</div>
					<div>
						<Label htmlFor="note-content">Content</Label>
						<Textarea
							id="note-content"
							name="content"
							defaultValue={data.note.content}
							required
							maxLength={contentMaxLength}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList errors={fieldErrors?.content} />
						</div>
					</div>
				</div>
				<ErrorList errors={formErrors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={formId} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={formId}
					type="submit"
					disabled={isSubmitting}
					status={isSubmitting ? 'pending' : 'idle'}
				>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
