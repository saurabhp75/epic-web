import { json, type DataFunctionArgs, redirect } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { db } from '#app/utils/db.server'
import {
	invariantResponse,
	useFocusInvalid,
	useIsSubmitting,
} from '#app/utils/misc'
import { Label } from '@radix-ui/react-label'
import { Input } from '#app/components/ui/input'
import { Button } from '#app/components/ui/button'
import { floatingToolbarClassName } from '#app/components/floating-toolbar'
import { Textarea } from '#app/components/ui/textarea'
import { StatusButton } from '#app/components/ui/status-button'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

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

const titleMaxLength = 100
const contentMaxLength = 10000

const NoteEditorSchema = z.object({
	// We can optionally add an error message to zod
	title: z
		.string()
		.min(1, { message: 'title is required' })
		.max(titleMaxLength),
	content: z.string().min(1).max(contentMaxLength),
})

export async function action({ request, params }: DataFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await request.formData()

	const result = NoteEditorSchema.safeParse({
		title: formData.get('title'),
		content: formData.get('content'),
	})

	if (!result.success) {
		return json({ status: 'error', errors: result.error.flatten() } as const, {
			status: 400,
		})
	}

	const { title, content } = result.data

	db.note.update({
		where: { id: { equals: params.noteId } },
		data: { title, content },
	})

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({
	id,
	errors,
}: {
	id?: string
	errors?: Array<string> | null
}) {
	return errors?.length ? (
		<ul className="flex flex-col gap-1">
			{errors.map((error, i) => (
				<li id={id} key={i} className="text-[10px] text-foreground-destructive">
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

	const formRef = useRef<HTMLFormElement>(null)

	// 🐨 determine whether this form is submitting
	const isSubmitting = useIsSubmitting()
	// we can use useId hook for form and input field ids
	const formId = 'note-editor'

	const fieldErrors =
		actionData?.status === 'error' ? actionData.errors.fieldErrors : null
	const formErrors =
		actionData?.status === 'error' ? actionData.errors.formErrors : null

	const isHydrated = useHydrated()

	const formHasErrors = Boolean(formErrors?.length)
	const formErrorId = formHasErrors ? 'form-error' : undefined
	// title may be undefined on the fieldErrors
	const titleHasErrors = Boolean(fieldErrors?.title?.length)
	const titleErrorId = titleHasErrors ? 'title-error' : undefined
	// content may be undefined on the fieldErrors

	const contentHasErrors = Boolean(fieldErrors?.content?.length)
	const contentErrorId = contentHasErrors ? 'content-error' : undefined

	// focuses on the first element in the form that
	// has an error whenever the "actionData" changes
	// 💰 we only care to focus on an element if:
	// - the formRef.current is truthy
	// - the actionData is in an error status
	// 🐨 if the formRef.current matches the query [aria-invalid="true"] then
	// focus on the form otherwise, run formRef.current.querySelector to find the
	// first [aria-invalid="true"] HTMLElement and focus that one instead.
	// 📜 https://mdn.io/element.matches
	// 🦺 You may need to add an instanceof HTMLElement check to be able to focus it.

	useFocusInvalid(formRef.current, actionData?.status === 'error')

	return (
		<div className="absolute inset-0">
			<Form
				id={formId}
				// Do client side html validation before JS is loaded
				// After JS loads, all validation done @ server side!!
				noValidate={isHydrated}
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				aria-invalid={formHasErrors || undefined}
				// aria-error is not supported on all browsers
				// so we use aria-describedby
				aria-describedby={formErrorId}
				// 🐨 add a tabIndex={-1} here so we can programmatically focus on the form
				// 📜 https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
				ref={formRef}
				tabIndex={-1}
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
							aria-invalid={titleHasErrors || undefined}
							aria-describedby={titleErrorId}
							autoFocus
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList id={titleErrorId} errors={fieldErrors?.title} />
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
							aria-invalid={contentHasErrors || undefined}
							aria-describedby={contentErrorId}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList id={contentErrorId} errors={fieldErrors?.content} />
						</div>
					</div>
				</div>
				<ErrorList id={formErrorId} errors={formErrors} />
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
