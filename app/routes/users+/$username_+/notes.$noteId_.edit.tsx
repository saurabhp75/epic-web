import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	type DataFunctionArgs,
	redirect,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { db, updateNote } from '#app/utils/db.server'
import { cn, invariantResponse, useIsSubmitting } from '#app/utils/misc'
import { Label } from '@radix-ui/react-label'
import { Input } from '#app/components/ui/input'
import { Button } from '#app/components/ui/button'
import { floatingToolbarClassName } from '#app/components/floating-toolbar'
import { Textarea } from '#app/components/ui/textarea'
import { StatusButton } from '#app/components/ui/status-button'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { z } from 'zod'
import type { FieldConfig } from '@conform-to/react'
import {
	useForm,
	conform,
	useFieldset,
	useFieldList,
	list,
} from '@conform-to/react'
import { useRef, useState } from 'react'
import { validateCSRF } from '#app/utils/csrf.server'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

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
		note: {
			title: note.title,
			content: note.content,
			images: note.images.map(i => ({ id: i.id, altText: i.altText })),
		},
	})
}

const titleMaxLength = 100
const contentMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ImageFieldsetSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.refine(file => {
			return file.size <= MAX_UPLOAD_SIZE
		}, 'File size must be less than 3MB')
		.optional(),
	altText: z.string().optional(),
})

const NoteEditorSchema = z.object({
	// We can optionally add an error message to zod
	title: z
		.string()
		.min(1, { message: 'title is required' })
		.max(titleMaxLength),
	content: z.string().min(1).max(contentMaxLength),
	images: z.array(ImageFieldsetSchema),
})

export async function action({ request, params }: DataFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)

	await validateCSRF(formData, request.headers)

	const submission = parse(formData, {
		schema: NoteEditorSchema,
	})

	// 🐨 If the submission.intent is not "submit" then return the submission with
	// a status of 'idle' and the submission.
	// when will this usecase happen?
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value) {
		// Send the submitted data back in case of error
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { title, content, images } = submission.value
	await updateNote({ id: params.noteId, title, content, images })

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

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	// 🐨 determine whether this form is submitting
	const isSubmitting = useIsSubmitting()

	const [form, fields] = useForm({
		// we can use useId hook to get the id
		id: 'note-editor',
		constraint: getFieldsetConstraint(NoteEditorSchema),
		lastSubmission: actionData?.submission,
		// Conform enables validation of formData
		// on the client without n/w request.
		onValidate({ formData }) {
			return parse(formData, { schema: NoteEditorSchema })
		},
		defaultValue: {
			title: data.note.title,
			content: data.note.content,
			images: data.note.images.length ? data.note.images : [{}],
		},
	})

	const imageList = useFieldList(form.ref, fields.images)

	return (
		<div className="absolute inset-0">
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<AuthenticityTokenInput />
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor={fields.title.id}>Title</Label>
						<Input autoFocus {...conform.input(fields.title)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.title.errorId}
								errors={fields.title.errors}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor={fields.content.id}>Content</Label>
						<Textarea {...conform.textarea(fields.content)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.content.errorId}
								errors={fields.content.errors}
							/>
						</div>
					</div>
					<div>
						<Label>Images</Label>
						<ul className="flex flex-col gap-4">
							{imageList.map((image, index) => (
								<li
									className="relative border-b-2 border-muted-foreground"
									key={image.key}
								>
									<button
										className="text-foreground-destructive absolute right-0 top-0"
										{...list.remove(fields.images.name, { index })}
									>
										<span aria-hidden>❌</span>{' '}
										<span className="sr-only">Remove image {index + 1}</span>
									</button>
									<ImageChooser config={image} />
								</li>
							))}
						</ul>
					</div>
					<Button
						className="mt-3"
						{...list.insert(fields.images.name, { defaultValue: {} })}
					>
						<span aria-hidden>➕ Image</span>{' '}
						<span className="sr-only">Add image</span>
					</Button>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={form.id}
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

function ImageChooser({
	image,
	config,
}: {
	image?: { id: string; altText?: string | null }
	config: FieldConfig<z.infer<typeof ImageFieldsetSchema>>
}) {
	// 🐨 the existingImage should now be based on whether fields.id.defaultValue is set
	const ref = useRef<HTMLFieldSetElement>(null)
	const fields = useFieldset(ref, config)
	const existingImage = Boolean(fields.id.defaultValue)

	const [previewImage, setPreviewImage] = useState<string | null>(
		existingImage ? `/resources/images/${fields.id.defaultValue}` : null,
	)
	const [altText, setAltText] = useState(fields.altText.defaultValue ?? '')

	return (
		<fieldset ref={ref} {...conform.fieldset(config)}>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							htmlFor={fields.file.id}
							className={cn('group absolute h-32 w-32 rounded-lg', {
								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
									!previewImage,
								'cursor-pointer focus-within:ring-4': !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ''}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									➕
								</div>
							)}
							{/* Send the image-id of existing image for update */}
							{existingImage ? (
								<input
									{...conform.input(fields.id, {
										type: 'hidden',
									})}
								/>
							) : null}
							<input
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={event => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(reader.result as string)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								accept="image/*"
								{...conform.input(fields.file, {
									type: 'file',
								})}
							/>
						</label>
					</div>
					<div className="min-h-[32px] px-4 pb-3 pt-1">
						<ErrorList id={fields.file.errorId} errors={fields.file.errors} />
					</div>
				</div>
				<div className="flex-1">
					<Label htmlFor={fields.altText.id}>Alt Text</Label>
					<Textarea
						{...conform.textarea(fields.altText)}
						onChange={e => setAltText(e.currentTarget.value)}
					/>
				</div>
			</div>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				<ErrorList id={config.errorId} errors={config.errors} />
			</div>
		</fieldset>
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
